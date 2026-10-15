import {
  ActionRowBuilder,
  ButtonInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  Colors,
  DiscordjsError,
  EmbedBuilder,
  MessageFlags,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import {
  getAddUserModal,
  parsePoints,
  POINTS_FIELD_ID,
  TYPE_FIELD_ID,
  USERS_FIELD_ID,
} from "../../../commands/subcommands/events/addUser";
import { getRemoveUserModal } from "../../../commands/subcommands/events/removeUser";
import { errors, templates, titles } from "../../../config/constants";
import { isParticipantType } from "../../../config/EventParticipantOptions";
import { Bot } from "../../../models";
import { getGuildConfigFromDb } from "../../../utils/dbUtils";
import { errorHandler } from "../../../utils/errorHandler";
import { logToWebhook } from "../../../utils/logHandler";
import { EngineInstallationClient } from "../client";
import { buildEngineEventEmbed, buildEngineStaffRow } from "../embeds";
import { discordThreadLink, replaceDiscordThreads } from "../links";
import {
  interestedDiscordIds,
  ParticipantTarget,
  planEventEdit,
  planParticipantChange,
  primaryThreadId,
} from "../staffActions";
import { EngineActor, EngineEventDetail, EngineParticipant } from "../types";

import {
  engineCommand,
  engineErrorMessage,
  interactionActor,
  replyOrEdit,
  requireInstallation,
} from "./common";

const MODAL_TIMEOUT_MS = 14 * 60 * 1000;
const BROADCAST_FIELD_ID = "message";
const MENTIONS_PER_MESSAGE = 25;
const MAX_POINTS = 100;

type StaffInteraction = ChatInputCommandInteraction | ButtonInteraction;

async function eventCard(
  client: EngineInstallationClient,
  eventId: string,
  actor: EngineActor,
  iconUrl?: string | null,
) {
  const [event, participants] = await Promise.all([
    client.getEvent(eventId, actor),
    client.listParticipants(eventId),
  ]);
  const row = buildEngineStaffRow(event);
  return {
    event,
    embeds: [buildEngineEventEmbed(event, participants, "info", iconUrl)],
    components: row ? [row] : [],
  };
}

/**
 * Waits for a modal submission, returning null on timeout.
 *
 * @param interaction The interaction that showed the modal.
 * @param customId The modal custom id.
 * @returns The submission, or null.
 */
async function awaitModal(
  interaction: StaffInteraction,
  customId: string,
): Promise<ModalSubmitInteraction | null> {
  try {
    return await interaction.awaitModalSubmit({
      filter: (i) => i.customId === customId,
      time: MODAL_TIMEOUT_MS,
    });
  } catch (err) {
    if (err instanceof DiscordjsError) return null;
    throw err;
  }
}

/**
 * Answers a deferred modal submission with the engine's refusal, or a
 * generic error that is also reported.
 *
 * @param bot The bot instance.
 * @param submit The modal submission.
 * @param area The breadcrumb.
 * @param err The error.
 */
async function failSubmit(
  bot: Bot,
  submit: ModalSubmitInteraction,
  area: string,
  err: unknown,
) {
  const message = engineErrorMessage(err);
  await submit.editReply({
    content: message ?? errors.SomethingWentWrongError,
    embeds: [],
    components: [],
  });
  if (!message) {
    await errorHandler(
      bot,
      `commands > ${area}`,
      err,
      submit.guild?.name,
      undefined,
      submit,
    );
  }
}

async function resolveTargets(
  client: EngineInstallationClient,
  users: { id: string; username: string }[],
  participants: EngineParticipant[],
  actor: EngineActor,
  ensureMembers: boolean,
): Promise<ParticipantTarget[]> {
  return await Promise.all(
    users.map(async (user) => {
      const known = participants.find((p) =>
        p.user.platforms.some(
          (platform) =>
            platform.provider === "discord" && platform.subject === user.id,
        ),
      );
      if (known) return { discordId: user.id, userId: known.user.id };
      const member = ensureMembers
        ? await client.ensureMemberByDiscordId(user.id, user.username, actor)
        : await client.findMemberByDiscordId(user.id);
      return { discordId: user.id, userId: member?.user.id ?? null };
    }),
  );
}

async function setThreadLinks(
  bot: Bot,
  client: EngineInstallationClient,
  event: EngineEventDetail,
  threadIds: string[],
) {
  const links = await Promise.all(
    threadIds.map(async (id) => {
      const channel = await bot.channels.fetch(id).catch(() => null);
      const name =
        channel && "name" in channel && channel.name ? channel.name : id;
      return discordThreadLink(client.guildId, { id, name });
    }),
  );
  return await client.putLinks(
    event.id,
    replaceDiscordThreads(event.externalLinks, links),
  );
}

const handleEdit = engineCommand(
  "events > edit (engine)",
  async (bot, interaction, client) => {
    await interaction.deferReply();
    const id = interaction.options.getString("id", true);
    const field = interaction.options.getString("field", true);
    const value = interaction.options.getString("value", true);
    const actor = interactionActor(interaction);
    const event = await client.getEvent(id, actor);
    const plan = planEventEdit(field, value, event);
    if (plan.kind === "error") {
      await interaction.editReply(plan.message);
      return;
    }
    if (plan.kind === "transition") {
      if (!event.allowedTransitions.includes(plan.to)) {
        await interaction.editReply(
          `Can't move this event from **${event.status}** to **${plan.to}**${
            event.allowedTransitions.length
              ? ` (allowed: ${event.allowedTransitions.join(", ")})`
              : ""
          }.`,
        );
        return;
      }
      await client.transition(
        id,
        plan.to,
        actor,
        `Edited from Discord by ${interaction.user.username}`,
      );
    } else if (plan.kind === "threads") {
      if (!event.permissions.canSetLinks) {
        await interaction.editReply(errors.StaffRestrictionError);
        return;
      }
      await setThreadLinks(bot, client, event, plan.threadIds);
    } else {
      await client.updateEvent(id, plan.body, actor);
    }
    const card = await eventCard(
      client,
      id,
      actor,
      interaction.guild?.iconURL(),
    );
    await interaction.editReply({
      content: templates.eventUpdated(id),
      embeds: card.embeds,
      components: card.components,
    });
  },
);

function broadcastModal(customId: string, eventId: string) {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(`Event Broadcast: ${eventId}`.slice(0, 45))
    .addComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(BROADCAST_FIELD_ID)
          .setLabel("What message would you like to send?")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(2000)
          .setRequired(false),
      ),
    );
}

const handleBroadcast = engineCommand(
  "events > broadcast (engine)",
  async (bot, interaction, client) => {
    const eventId = interaction.options.getString("id", true);
    const channelOption =
      interaction.options.getChannel<ChannelType.GuildText>("channel");
    const customId = `engineBroadcast${Math.floor(Math.random() * 1e6)}`;
    await interaction.showModal(broadcastModal(customId, eventId));
    const submit = await awaitModal(interaction, customId);
    if (!submit) return;
    await submit.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const actor = interactionActor(submit);
      const [event, participants] = await Promise.all([
        client.getEvent(eventId, actor),
        client.listParticipants(eventId),
      ]);
      if (!event.me?.isLeader && !event.permissions.canEdit) {
        await submit.editReply(errors.BRLeaderRestrictionError);
        return;
      }
      const threadId = channelOption?.id ?? primaryThreadId(event);
      const channel = threadId
        ? await bot.channels.fetch(threadId).catch(() => null)
        : null;
      if (!channel?.isSendable() || channel.isDMBased()) {
        await submit.editReply(
          "This event has no linked thread I can post in. Pass a channel instead.",
        );
        return;
      }
      const ids = interestedDiscordIds(participants);
      for (let i = 0; i < ids.length; i += MENTIONS_PER_MESSAGE) {
        await channel.send({
          content: ids
            .slice(i, i + MENTIONS_PER_MESSAGE)
            .map((id) => `<@${id}>`)
            .join(" "),
        });
      }
      const text = submit.fields.getTextInputValue(BROADCAST_FIELD_ID);
      if (text.length > 0) {
        const message = await channel.send({ content: text });
        await message.pin().catch(() => undefined);
      }
      await submit.editReply("Your message has been broadcasted!");
      const config = interaction.guildId
        ? await getGuildConfigFromDb(bot, interaction.guildId)
        : undefined;
      if (config?.logWebhookUrl) {
        await logToWebhook(
          {
            embeds: [
              new EmbedBuilder()
                .setColor(Colors.Green)
                .setTimestamp()
                .setTitle(titles.EventBroadcast)
                .setDescription(
                  `<@${interaction.user.id}> broadcasted message for event ${event.id} in <#${channel.id}>`,
                ),
            ],
          },
          config.logWebhookUrl,
        ).catch(() => undefined);
      }
    } catch (err) {
      await failSubmit(bot, submit, "events > broadcast (engine)", err);
    }
  },
);

const handleAddUser = engineCommand(
  "events > adduser (engine)",
  async (bot, interaction, client) => {
    await runEngineParticipantFlow(
      bot,
      interaction,
      client,
      interaction.options.getString("id", true),
      "add",
    );
  },
);

const handleRemoveUser = engineCommand(
  "events > removeuser (engine)",
  async (bot, interaction, client) => {
    await runEngineParticipantFlow(
      bot,
      interaction,
      client,
      interaction.options.getString("id", true),
      "remove",
    );
  },
);

/**
 * Runs the add/remove participants modal against the engine as the staff
 * actor. Shared by `/events adduser|removeuser` and the Add/Remove Points
 * buttons on the event card.
 *
 * @param bot The bot instance.
 * @param interaction The slash command or button interaction.
 * @param client The installation client.
 * @param eventId The event id.
 * @param action Add or remove.
 */
export async function runEngineParticipantFlow(
  bot: Bot,
  interaction: StaffInteraction,
  client: EngineInstallationClient,
  eventId: string,
  action: "add" | "remove",
) {
  const customId = `engineParticipants${Math.floor(Math.random() * 1e6)}`;
  await interaction.showModal(
    action === "add"
      ? getAddUserModal(customId, eventId)
      : getRemoveUserModal(customId, eventId),
  );
  const submit = await awaitModal(interaction, customId);
  if (!submit) return;
  await submit.deferReply();
  const area = `events > ${action === "add" ? "adduser" : "removeuser"} (engine)`;
  try {
    const [kind] = submit.fields.getStringSelectValues(TYPE_FIELD_ID);
    if (!isParticipantType(kind)) {
      await submit.editReply(errors.InvalidParticipantTypeError);
      return;
    }
    const points =
      action === "add"
        ? parsePoints(submit.fields.getTextInputValue(POINTS_FIELD_ID))
        : 0;
    if (points === null) {
      await submit.editReply(templates.invalidPoints(MAX_POINTS));
      return;
    }
    const actor = interactionActor(submit);
    const users = [
      ...submit.fields.getSelectedUsers(USERS_FIELD_ID, true).values(),
    ];
    const [event, participants] = await Promise.all([
      client.getEvent(eventId, actor),
      client.listParticipants(eventId),
    ]);
    const targets = await resolveTargets(
      client,
      users,
      participants,
      actor,
      action === "add",
    );
    const plan = planParticipantChange(
      action,
      kind,
      points,
      targets,
      participants,
      event.status,
    );
    for (const patch of plan.patches) {
      await client.updateParticipant(eventId, patch.userId, patch.body, actor);
    }
    if (plan.results.length > 0) {
      await client.recordResults(eventId, plan.results, actor);
    }
    const changed = users.filter((u) => !plan.notListed.includes(u.id));
    const names = changed.map((u) => u.username).join(", ");
    const pointsApply =
      kind === "readers" || (kind === "leaders" && plan.results.length > 0);
    const card = await eventCard(
      client,
      eventId,
      actor,
      submit.guild?.iconURL(),
    );
    let content: string;
    if (action === "add") {
      content = templates.participantsAdded(
        changed.length,
        eventId,
        kind,
        pointsApply ? points : 0,
        names,
      );
    } else if (changed.length === 0) {
      content = `No changes made. None of the selected user(s) were listed as ${kind} for this event.`;
    } else {
      content = templates.participantsRemoved(
        changed.length,
        eventId,
        kind,
        names,
        plan.notListed.length > 0
          ? templates.participantsNotListedSuffix(plan.notListed.length)
          : "",
      );
    }
    await submit.editReply({
      content,
      embeds: card.embeds,
      components: card.components,
    });
  } catch (err) {
    await failSubmit(bot, submit, area, err);
  }
}

/**
 * Handles the Add/Remove Points buttons on the engine event card.
 *
 * @param bot The bot instance.
 * @param interaction The button interaction.
 * @param action Add or remove.
 */
export async function handleEngineParticipantButton(
  bot: Bot,
  interaction: ButtonInteraction,
  action: "add" | "remove",
) {
  const prefix = action === "add" ? "evt-addpts-" : "evt-rmpts-";
  const client = await requireInstallation(bot, interaction);
  if (!client) return;
  try {
    await runEngineParticipantFlow(
      bot,
      interaction,
      client,
      interaction.customId.slice(prefix.length),
      action,
    );
  } catch (err) {
    const message = engineErrorMessage(err);
    if (!message) throw err;
    await replyOrEdit(interaction, message);
  }
}

export const engineStaffHandlers = {
  edit: handleEdit,
  broadcast: handleBroadcast,
  adduser: handleAddUser,
  removeuser: handleRemoveUser,
};
