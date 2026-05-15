import {
  EventDocument,
  EventDtoStatusEnum,
} from "@organizedbookclub/ows-client";
import { ButtonInteraction, GuildMember, MessageFlags, User } from "discord.js";

import { runAddUserFlow } from "../../../commands/subcommands/events/addUser";
import { showAnnounceModalAndPost } from "../../../commands/subcommands/events/announce";
import { showCreateThreadModalAndCreate } from "../../../commands/subcommands/events/createThread";
import { showEventEditModal } from "../../../commands/subcommands/events/edit";
import { runRemoveUserFlow } from "../../../commands/subcommands/events/removeUser";
import { buildUserEventStatsContainer } from "../../../commands/subcommands/events/stats";
import { showQotdPostModalAndPost } from "../../../commands/subcommands/qotd/post";
import { errors, messages, templates } from "../../../config/constants";
import { Bot } from "../../../models";
import { QotdSuggestionStatus } from "../../../models/commands/qotd/QotdSuggestionStatus";
import { getGuildConfigFromDb } from "../../../utils/dbUtils";
import { errorHandler } from "../../../utils/errorHandler";
import {
  getEventAnnouncementEmbed,
  getEventInfoEmbed,
  getEventInfoStaffActionRow,
  getEventRequestEmbed,
} from "../../../utils/eventUtils";
import {
  normalizeCustomId,
  upsertInteractionUsage,
} from "../../../utils/interactionUsageUtils";
import {
  hasRole,
  participantToDto,
  upsertUser,
} from "../../../utils/userUtils";

/**
 * Handles the logic for button clicks.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const processButtonClick = async (bot: Bot, interaction: ButtonInteraction) => {
  try {
    if (interaction.customId === "bookmark-delete") {
      await handleBookmarkDelete(interaction);
    } else if (
      interaction.customId.startsWith("er-") ||
      interaction.customId.startsWith("ea-")
    ) {
      await handleEventActions(interaction, bot);
    } else if (interaction.customId.startsWith("qs-")) {
      await handleQotdSuggestionActions(interaction, bot);
    } else if (interaction.customId.startsWith("evt-info-")) {
      await handleEventInfo(interaction, bot);
    } else if (interaction.customId.startsWith("evt-edit-")) {
      await handleEventEdit(interaction, bot);
    } else if (interaction.customId.startsWith("evt-approve-")) {
      await handleEventStatusChange(
        interaction,
        bot,
        EventDtoStatusEnum.Approved,
      );
    } else if (interaction.customId.startsWith("evt-reject-")) {
      await handleEventStatusChange(
        interaction,
        bot,
        EventDtoStatusEnum.Rejected,
      );
    } else if (interaction.customId.startsWith("evt-thread-")) {
      await handleEventThread(interaction, bot);
    } else if (interaction.customId.startsWith("evt-announce-")) {
      await handleEventAnnounce(interaction, bot);
    } else if (interaction.customId.startsWith("evt-addpts-")) {
      await handleEventAddPoints(interaction, bot);
    } else if (interaction.customId.startsWith("evt-rmpts-")) {
      await handleEventRemovePoints(interaction, bot);
    } else if (interaction.customId.startsWith("evt-join-")) {
      await handleEventListInterest(interaction, bot, "join");
    } else if (interaction.customId.startsWith("evt-leave-")) {
      await handleEventListInterest(interaction, bot, "leave");
    } else if (interaction.customId.startsWith("qotd-post-")) {
      await handleQotdPost(interaction, bot);
    } else if (interaction.customId.startsWith("usr-stats-")) {
      await handleUserStats(interaction, bot);
    } else {
      return;
    }
    await upsertInteractionUsage(
      bot,
      "button",
      normalizeCustomId(interaction.customId),
    );
  } catch (error) {
    await errorHandler(
      bot,
      "interactionCreate > processButtonClick",
      error,
      interaction.guild?.name,
      interaction.message,
      undefined,
    );
  }
};

async function handleQotdSuggestionActions(
  interaction: ButtonInteraction,
  bot: Bot,
) {
  await interaction.deferReply();
  const [_, qotdId, action] = interaction.customId.split("-");

  if (action === "approve") {
    await bot.db.qotds.update({
      where: { id: qotdId },
      data: { status: QotdSuggestionStatus.Approved, updatedOn: new Date() },
    });
    await interaction.message.edit({
      content: messages.QotdApproved,
      embeds: interaction.message.embeds,
      components: [],
    });
    await interaction.editReply(templates.qotdActionAck("Approved", qotdId));
  } else if (action === "reject") {
    await bot.db.qotds.update({
      where: { id: qotdId },
      data: { status: QotdSuggestionStatus.Rejected, updatedOn: new Date() },
    });
    await interaction.message.edit({
      content: messages.QotdRejected,
      embeds: interaction.message.embeds,
      components: [],
    });
    await interaction.editReply(templates.qotdActionAck("Rejected", qotdId));
  }
}

type InterestAction = "join" | "leave";

type ToggleInterestResult =
  | { ok: true; eventDoc: EventDocument }
  | {
      ok: false;
      reason: "notFound" | "alreadyInterested" | "neverInterested";
    };

/**
 * Error message map for the participant-toggle button flows. Both the
 * request/announcement embed (`er-`/`ea-`) buttons and the event-list
 * Join / Leave buttons funnel through here, so the messages are written
 * for the button context — the user did not type an ID, so "Event not
 * found." is more accurate than "Invalid event ID! Please try again...".
 */
const PARTICIPANT_TOGGLE_ERRORS: Record<
  Exclude<ToggleInterestResult, { ok: true }>["reason"],
  string
> = {
  notFound: errors.EventNotFoundError,
  alreadyInterested: errors.AlreadyInterestedError,
  neverInterested: errors.NeverInterestedError,
};

/**
 * Adds or removes the given Discord user to/from the event's `interested`
 * participant list. Idempotent against the requested action — refuses with a
 * tagged reason when the desired transition is a no-op (already in /
 * already out) or the event does not exist.
 *
 * Used by both the request/announcement embed buttons (which then re-render
 * the parent embed) and the event-list Join / Leave buttons (which only ack
 * ephemerally), so it deliberately does not touch the calling
 * interaction or any UI surface.
 *
 * @param bot The bot instance.
 * @param eventId The event's object ID.
 * @param user The acting Discord user.
 * @param action Whether to add (`"join"`) or remove (`"leave"`).
 * @returns A discriminated result with the updated event doc on success.
 */
async function toggleEventInterest(
  bot: Bot,
  eventId: string,
  user: User,
  action: InterestAction,
): Promise<ToggleInterestResult> {
  let eventDoc: EventDocument;
  try {
    const eventResponse = await bot.api.events.eventsControllerFindOne({
      id: eventId,
    });
    eventDoc = eventResponse.data;
  } catch {
    return { ok: false, reason: "notFound" };
  }

  const isInterested = eventDoc.interested.some(
    (x) => x.user?.userId === user.id,
  );
  if (action === "join" && isInterested) {
    return { ok: false, reason: "alreadyInterested" };
  }
  if (action === "leave" && !isInterested) {
    return { ok: false, reason: "neverInterested" };
  }

  let nextInterested;
  if (action === "join") {
    const userDoc = await upsertUser(bot.api, user.id, user.username);
    nextInterested = [
      ...eventDoc.interested.map((x) => participantToDto(x)),
      { user: userDoc._id, points: 0 },
    ];
  } else {
    nextInterested = eventDoc.interested
      .filter((x) => x.user?.userId !== user.id)
      .map((x) => participantToDto(x));
  }

  const response = await bot.api.events.eventsControllerUpdate({
    id: eventId,
    updateEventDto: { interested: nextInterested },
  });
  return { ok: true, eventDoc: response.data };
}

async function handleEventActions(interaction: ButtonInteraction, bot: Bot) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const [embedType, eventId, customAction] = interaction.customId.split("-");
  const action: InterestAction =
    customAction === "interested" ? "join" : "leave";

  const result = await toggleEventInterest(
    bot,
    eventId,
    interaction.user,
    action,
  );
  if (!result.ok) {
    await interaction.editReply({
      content: PARTICIPANT_TOGGLE_ERRORS[result.reason],
    });
    return;
  }

  let updatedEmbed;
  if (embedType === "er") {
    updatedEmbed = getEventRequestEmbed(result.eventDoc, interaction);
  } else if (embedType === "ea") {
    updatedEmbed = getEventAnnouncementEmbed(result.eventDoc, interaction);
  }
  if (!updatedEmbed) {
    await interaction.editReply(errors.EmbedUpdateError);
    return;
  }
  await interaction.message.edit({ embeds: [updatedEmbed] });
  await interaction.editReply({
    content:
      action === "join" ? messages.ParticipantJoined : messages.ParticipantLeft,
  });
}

async function handleBookmarkDelete(interaction: ButtonInteraction) {
  try {
    await interaction.message.delete();
  } catch {
    await interaction.reply({
      content: errors.SomethingWentWrongShortError,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleEventInfo(interaction: ButtonInteraction, bot: Bot) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const eventId = interaction.customId.slice("evt-info-".length);

  let eventDoc: EventDocument;
  try {
    const eventResponse = await bot.api.events.eventsControllerFindOne({
      id: eventId,
    });
    eventDoc = eventResponse.data;
  } catch {
    await interaction.editReply(errors.EventNotFoundError);
    return;
  }

  try {
    const embed = getEventInfoEmbed(eventDoc, interaction);

    let actionRow = null;
    if (interaction.inGuild() && interaction.guildId) {
      const guildConfig = await getGuildConfigFromDb(bot, interaction.guildId);
      const isStaff =
        !!guildConfig &&
        !!interaction.member &&
        hasRole(interaction.member as GuildMember, guildConfig.staffRole);
      if (isStaff) {
        actionRow = getEventInfoStaffActionRow(eventDoc);
      }
    }

    await interaction.editReply({
      embeds: [embed],
      components: actionRow ? [actionRow] : [],
    });
  } catch {
    await interaction.editReply(errors.EventInfoFetchError);
  }
}

async function handleEventListInterest(
  interaction: ButtonInteraction,
  bot: Bot,
  action: InterestAction,
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const prefix = action === "join" ? "evt-join-" : "evt-leave-";
  const eventId = interaction.customId.slice(prefix.length);

  const result = await toggleEventInterest(
    bot,
    eventId,
    interaction.user,
    action,
  );
  if (!result.ok) {
    await interaction.editReply(PARTICIPANT_TOGGLE_ERRORS[result.reason]);
    return;
  }
  await interaction.editReply(
    action === "join"
      ? templates.eventListJoined(
          result.eventDoc._id,
          result.eventDoc.book.title,
        )
      : templates.eventListLeft(
          result.eventDoc._id,
          result.eventDoc.book.title,
        ),
  );
}

async function handleQotdPost(interaction: ButtonInteraction, bot: Bot) {
  if (!interaction.guild || !interaction.guildId) {
    await interaction.reply({
      content: errors.GuildOnlyActionError,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const guildConfig = await getGuildConfigFromDb(bot, interaction.guildId);
  if (!guildConfig) {
    await interaction.reply({
      content: errors.GuildNotConfiguredError,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (
    interaction.member &&
    !hasRole(interaction.member as GuildMember, guildConfig.staffRole)
  ) {
    await interaction.reply({
      content: errors.StaffRestrictionActionError,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const qotdId = interaction.customId.slice("qotd-post-".length);
  const qotd = await bot.db.qotds.findUnique({ where: { id: qotdId } });
  if (!qotd) {
    await interaction.reply({
      content: errors.QotdNotFoundError,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (qotd.status !== QotdSuggestionStatus.Approved) {
    await interaction.reply({
      content: errors.QotdUnavailableError,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await showQotdPostModalAndPost(
    bot,
    interaction,
    interaction.guild,
    guildConfig,
    qotd,
    null,
  );
}

async function handleUserStats(interaction: ButtonInteraction, bot: Bot) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const discordId = interaction.customId.slice("usr-stats-".length);
  try {
    const user = await bot.users.fetch(discordId);
    const result = await buildUserEventStatsContainer(bot, user, interaction);
    if (typeof result === "string") {
      await interaction.editReply(result);
      return;
    }
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [result],
    });
  } catch {
    await interaction.editReply(errors.UserStatsFetchError);
  }
}

async function handleEventEdit(interaction: ButtonInteraction, bot: Bot) {
  const ctx = await requireStaffAndEvent(interaction, bot, "evt-edit-");
  if (!ctx) return;
  await showEventEditModal(bot, interaction, ctx.eventDoc);
}

/**
 * Validates that the click came from staff in a configured guild and resolves
 * the event id from the customId, fetching the event doc. Replies ephemerally
 * with the appropriate error and returns null if any check fails.
 */
async function requireStaffAndEvent(
  interaction: ButtonInteraction,
  bot: Bot,
  prefix: string,
): Promise<{
  eventDoc: EventDocument;
  guildConfig: NonNullable<Awaited<ReturnType<typeof getGuildConfigFromDb>>>;
} | null> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: errors.GuildOnlyActionError,
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
  const guildConfig = await getGuildConfigFromDb(bot, interaction.guildId);
  if (!guildConfig) {
    await interaction.reply({
      content: errors.GuildNotConfiguredError,
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
  if (
    !interaction.member ||
    !hasRole(interaction.member as GuildMember, guildConfig.staffRole)
  ) {
    await interaction.reply({
      content: errors.StaffRestrictionError,
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
  const eventId = interaction.customId.slice(prefix.length);
  let eventDoc: EventDocument;
  try {
    const response = await bot.api.events.eventsControllerFindOne({
      id: eventId,
    });
    eventDoc = response.data;
  } catch {
    await interaction.reply({
      content: errors.EventNotFoundError,
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
  return { eventDoc, guildConfig };
}

async function handleEventStatusChange(
  interaction: ButtonInteraction,
  bot: Bot,
  newStatus: EventDtoStatusEnum,
) {
  const prefix =
    newStatus === EventDtoStatusEnum.Approved ? "evt-approve-" : "evt-reject-";
  const ctx = await requireStaffAndEvent(interaction, bot, prefix);
  if (!ctx) return;
  if (ctx.eventDoc.status !== EventDtoStatusEnum.Requested) {
    await interaction.reply({
      content: templates.mustBeInState(
        "Requested",
        `be ${newStatus.toLowerCase()}`,
      ),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await bot.api.events.eventsControllerUpdate({
    id: ctx.eventDoc._id,
    updateEventDto: { status: newStatus },
  });
  await interaction.editReply(
    templates.eventStatusChanged(ctx.eventDoc._id, newStatus),
  );
}

async function handleEventThread(interaction: ButtonInteraction, bot: Bot) {
  const ctx = await requireStaffAndEvent(interaction, bot, "evt-thread-");
  if (!ctx) return;
  if (ctx.eventDoc.status !== EventDtoStatusEnum.Approved) {
    await interaction.reply({
      content: templates.mustBeInState("Approved", "create a thread"),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (!interaction.guildId) return;
  await showCreateThreadModalAndCreate(
    bot,
    interaction,
    ctx.eventDoc,
    ctx.guildConfig,
  );
}

async function handleEventAnnounce(interaction: ButtonInteraction, bot: Bot) {
  const ctx = await requireStaffAndEvent(interaction, bot, "evt-announce-");
  if (!ctx) return;
  if (ctx.eventDoc.status !== EventDtoStatusEnum.Approved) {
    await interaction.reply({
      content: templates.mustBeInState("Approved", "be announced"),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (!ctx.eventDoc.threads || ctx.eventDoc.threads.length === 0) {
    await interaction.reply({
      content: templates.createThreadFirst(),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (!interaction.guildId) return;
  await showAnnounceModalAndPost(
    bot,
    interaction,
    ctx.eventDoc,
    ctx.guildConfig,
  );
}

async function handleEventAddPoints(interaction: ButtonInteraction, bot: Bot) {
  const ctx = await requireStaffAndEvent(interaction, bot, "evt-addpts-");
  if (!ctx) return;
  await runAddUserFlow(bot, interaction, ctx.eventDoc._id);
}

async function handleEventRemovePoints(
  interaction: ButtonInteraction,
  bot: Bot,
) {
  const ctx = await requireStaffAndEvent(interaction, bot, "evt-rmpts-");
  if (!ctx) return;
  await runRemoveUserFlow(bot, interaction, ctx.eventDoc._id);
}

export { processButtonClick };
