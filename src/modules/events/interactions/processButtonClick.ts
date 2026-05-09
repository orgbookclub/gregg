import { EventDocument, EventDtoStatusEnum } from "@orgbookclub/ows-client";
import { ButtonInteraction, GuildMember, MessageFlags } from "discord.js";

import { runAddUserFlow } from "../../../commands/subcommands/events/addUser";
import { showAnnounceModalAndPost } from "../../../commands/subcommands/events/announce";
import { showCreateThreadModalAndCreate } from "../../../commands/subcommands/events/createThread";
import { showEventEditModal } from "../../../commands/subcommands/events/edit";
import { runRemoveUserFlow } from "../../../commands/subcommands/events/removeUser";
import { buildUserEventStatsEmbed } from "../../../commands/subcommands/events/stats";
import { showQotdPostModalAndPost } from "../../../commands/subcommands/qotd/post";
import { errors } from "../../../config/constants";
import { Bot } from "../../../models";
import { QotdSuggestionStatus } from "../../../models/commands/qotd/QotdSuggestionStatus";
import { getGuildConfigFromDb } from "../../../utils/dbUtils";
import { errorHandler } from "../../../utils/errorHandler";
import {
  getEventAnnouncementEmbed,
  getEventInfoEmbed,
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
      await handleEventListJoin(interaction, bot);
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
      content: "Approved",
      embeds: interaction.message.embeds,
      components: [],
    });
    await interaction.editReply(`Approved QOTD \`${qotdId}\``);
  } else if (action === "reject") {
    await bot.db.qotds.update({
      where: { id: qotdId },
      data: { status: QotdSuggestionStatus.Rejected, updatedOn: new Date() },
    });
    await interaction.message.edit({
      content: "Rejected",
      embeds: interaction.message.embeds,
      components: [],
    });
    await interaction.editReply(`Rejected QOTD \`${qotdId}\``);
  }
}

async function handleEventActions(interaction: ButtonInteraction, bot: Bot) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const [embedType, eventId, action] = interaction.customId.split("-");

  const userDoc = await upsertUser(
    bot.api,
    interaction.user.id,
    interaction.user.username,
  );

  const eventResponse = await bot.api.events.eventsControllerFindOne({
    id: eventId,
  });
  if (!eventResponse) {
    await interaction.editReply({
      content: "Invalid event ID! Please try again with a valid event ID.",
    });
    return;
  }
  const eventDoc = eventResponse.data;

  const isUserInterestedInEvent = eventDoc.interested.some(
    (x) => x.user.userId === interaction.user.id,
  );
  if (action === "interested" && isUserInterestedInEvent) {
    await interaction.editReply({
      content:
        "You are already marked as an interested participant of this event!",
    });
    return;
  } else if (action === "notInterested" && !isUserInterestedInEvent) {
    await interaction.editReply({
      content:
        "You were never marked as an interested participant of this event!",
    });
    return;
  }
  const participantDto = {
    points: 0,
    user: userDoc._id,
  };
  const updateEventDto = {
    interested:
      action === "interested"
        ? [
            ...eventDoc.interested.map((x) => participantToDto(x)),
            participantDto,
          ]
        : eventDoc.interested
            .filter((x) => x.user.userId !== interaction.user.id)
            .map((x) => participantToDto(x)),
  };
  const response = await bot.api.events.eventsControllerUpdate({
    id: eventId,
    updateEventDto: updateEventDto,
  });
  const updatedEventDoc = response.data;
  let updatedEmbed;

  if (embedType === "er") {
    updatedEmbed = getEventRequestEmbed(updatedEventDoc, interaction);
  } else if (embedType === "ea") {
    updatedEmbed = getEventAnnouncementEmbed(updatedEventDoc, interaction);
  }
  if (!updatedEmbed) {
    await interaction.editReply(
      "Something went wrong while updating the embed",
    );
    return;
  }
  await interaction.message.edit({ embeds: [updatedEmbed] });
  await interaction.editReply({
    content:
      action === "interested"
        ? "You have been marked as an interested participant for this event!"
        : "You are no longer a participant of this event",
  });
}

async function handleBookmarkDelete(interaction: ButtonInteraction) {
  await interaction.message.delete();
}

async function handleEventInfo(interaction: ButtonInteraction, bot: Bot) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const eventId = interaction.customId.slice("evt-info-".length);
  try {
    const eventResponse = await bot.api.events.eventsControllerFindOne({
      id: eventId,
    });
    if (!eventResponse) {
      await interaction.editReply("Event not found.");
      return;
    }
    const embed = getEventInfoEmbed(eventResponse.data, interaction);
    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply("Could not fetch event info.");
  }
}

async function handleEventListJoin(interaction: ButtonInteraction, bot: Bot) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const eventId = interaction.customId.slice("evt-join-".length);

  const eventResponse = await bot.api.events.eventsControllerFindOne({
    id: eventId,
  });
  if (!eventResponse) {
    await interaction.editReply("Event not found.");
    return;
  }
  const eventDoc = eventResponse.data;

  const alreadyInterested = eventDoc.interested.some(
    (x) => x.user.userId === interaction.user.id,
  );
  if (alreadyInterested) {
    await interaction.editReply(
      "You are already marked as an interested participant of this event!",
    );
    return;
  }

  const userDoc = await upsertUser(
    bot.api,
    interaction.user.id,
    interaction.user.username,
  );
  await bot.api.events.eventsControllerUpdate({
    id: eventId,
    updateEventDto: {
      interested: [
        ...eventDoc.interested.map((x) => participantToDto(x)),
        { user: userDoc._id, points: 0 },
      ],
    },
  });
  await interaction.editReply(
    `You have been marked as an interested participant of event withid \`${eventDoc._id}\` of \`${eventDoc.book.title}\`!`,
  );
}

async function handleQotdPost(interaction: ButtonInteraction, bot: Bot) {
  if (!interaction.guild || !interaction.guildId) {
    await interaction.reply({
      content: "This action only works inside a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const guildConfig = await getGuildConfigFromDb(bot, interaction.guildId);
  if (!guildConfig) {
    await interaction.reply({
      content: "This server is not configured.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (
    interaction.member &&
    !hasRole(interaction.member as GuildMember, guildConfig.staffRole)
  ) {
    await interaction.reply({
      content: "Sorry, this action is restricted for staff use only!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const qotdId = interaction.customId.slice("qotd-post-".length);
  const qotd = await bot.db.qotds.findUnique({ where: { id: qotdId } });
  if (!qotd) {
    await interaction.reply({
      content: "QOTD not found.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (qotd.status !== QotdSuggestionStatus.Approved) {
    await interaction.reply({
      content: "This QOTD is no longer available to post.",
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
    const result = await buildUserEventStatsEmbed(bot, user, interaction);
    if (typeof result === "string") {
      await interaction.editReply(result);
      return;
    }
    await interaction.editReply({ embeds: [result] });
  } catch {
    await interaction.editReply("Could not fetch stats for that user.");
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
      content: errors.InvalidEventIdError,
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
      content: `Event must be in 'Requested' state to be ${newStatus.toLowerCase()}.`,
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
    `Event \`${ctx.eventDoc._id}\` marked as **${newStatus}**.`,
  );
}

async function handleEventThread(interaction: ButtonInteraction, bot: Bot) {
  const ctx = await requireStaffAndEvent(interaction, bot, "evt-thread-");
  if (!ctx) return;
  if (ctx.eventDoc.status !== EventDtoStatusEnum.Approved) {
    await interaction.reply({
      content: "Event must be in 'Approved' state to create a thread.",
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
      content: "Event must be in 'Approved' state to be announced.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (!ctx.eventDoc.threads || ctx.eventDoc.threads.length === 0) {
    await interaction.reply({
      content: "Create a thread first before announcing.",
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
