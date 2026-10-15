import { ButtonInteraction, MessageFlags } from "discord.js";

import { errors, messages, templates } from "../../../config/constants";
import { Bot } from "../../../models";
import { OPENLIBRARY_BR_BUTTON_PREFIX } from "../../../utils/bookUtils";
import { EngineInstallationClient } from "../client";
import {
  buildEngineEventEmbed,
  buildEngineParticipationRow,
  buildEngineStaffRow,
  isTerminalStatus,
} from "../embeds";
import { engineStatusLabel } from "../mappings";
import { EngineActor, EngineEventDetail } from "../types";

import { handleEngineBookRequestButton } from "./books";
import {
  engineErrorMessage,
  interactionActor,
  replyOrEdit,
  requireInstallation,
} from "./common";
import { handleEngineParticipantButton } from "./staff";
import { buildEngineMemberStatsContainer, fetchMemberStats } from "./stats";

type ParticipationAction = "interested" | "notInterested" | "lead";

const PARTICIPATION_ACTIONS: ParticipationAction[] = [
  "interested",
  "notInterested",
  "lead",
];

/**
 * Applies a participation button for the actor. "lead" toggles: it
 * withdraws leadership when the actor already leads.
 *
 * @param client The installation client.
 * @param eventId The event id.
 * @param action The button action.
 * @param actor The actor.
 * @returns The updated event and a confirmation message.
 */
async function applyParticipation(
  client: EngineInstallationClient,
  eventId: string,
  action: ParticipationAction,
  actor: EngineActor,
): Promise<{ event: EngineEventDetail; message: string }> {
  if (action === "interested") {
    const event = await client.setInterest(eventId, true, actor);
    return { event, message: messages.ParticipantJoined };
  }
  if (action === "notInterested") {
    const event = await client.setInterest(eventId, false, actor);
    return { event, message: messages.ParticipantLeft };
  }
  const current = await client.getEvent(eventId, actor);
  if (current.me?.isLeader) {
    const event = await client.setLead(eventId, false, actor);
    return { event, message: "You are no longer leading this event." };
  }
  const event = await client.setLead(eventId, true, actor);
  return { event, message: "You are now leading this event!" };
}

async function withEngineErrors(
  interaction: ButtonInteraction,
  run: () => Promise<void>,
) {
  try {
    await run();
  } catch (error) {
    const message = engineErrorMessage(error);
    if (!message) throw error;
    await replyOrEdit(interaction, message);
  }
}

async function handleParticipationButton(
  bot: Bot,
  interaction: ButtonInteraction,
) {
  const [prefix, eventId, action] = interaction.customId.split("-");
  if (!PARTICIPATION_ACTIONS.includes(action as ParticipationAction)) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const client = await requireInstallation(bot, interaction);
  if (!client) return;
  await withEngineErrors(interaction, async () => {
    const { event, message } = await applyParticipation(
      client,
      eventId,
      action as ParticipationAction,
      interactionActor(interaction),
    );
    const participants = await client.listParticipants(eventId);
    await interaction.message.edit({
      embeds: [
        buildEngineEventEmbed(
          event,
          participants,
          prefix === "er" ? "request" : "announcement",
          interaction.guild?.iconURL(),
        ),
      ],
      components: [
        buildEngineParticipationRow(
          event.id,
          prefix === "er" ? "er" : "ea",
          isTerminalStatus(event.status),
        ),
      ],
    });
    await interaction.editReply(message);
  });
}

async function handleListInterest(
  bot: Bot,
  interaction: ButtonInteraction,
  join: boolean,
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const eventId = interaction.customId.slice(
    (join ? "evt-join-" : "evt-leave-").length,
  );
  const client = await requireInstallation(bot, interaction);
  if (!client) return;
  await withEngineErrors(interaction, async () => {
    const event = await client.setInterest(
      eventId,
      join,
      interactionActor(interaction),
    );
    await interaction.editReply(
      join
        ? templates.eventListJoined(event.id, event.title)
        : templates.eventListLeft(event.id, event.title),
    );
  });
}

async function handleTransition(
  bot: Bot,
  interaction: ButtonInteraction,
  to: "approved" | "rejected",
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const prefix = to === "approved" ? "evt-approve-" : "evt-reject-";
  const eventId = interaction.customId.slice(prefix.length);
  const client = await requireInstallation(bot, interaction);
  if (!client) return;
  await withEngineErrors(interaction, async () => {
    const event = await client.transition(
      eventId,
      to,
      interactionActor(interaction),
      `${engineStatusLabel(to)} from Discord by ${interaction.user.username}`,
    );
    await interaction.editReply(
      templates.eventStatusChanged(event.id, engineStatusLabel(event.status)),
    );
  });
}

async function handleInfo(bot: Bot, interaction: ButtonInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const eventId = interaction.customId.slice("evt-info-".length);
  const client = await requireInstallation(bot, interaction);
  if (!client) return;
  await withEngineErrors(interaction, async () => {
    const event = await client.getEvent(eventId, interactionActor(interaction));
    const participants = await client.listParticipants(eventId);
    const staffRow = buildEngineStaffRow(event);
    await interaction.editReply({
      embeds: [
        buildEngineEventEmbed(
          event,
          participants,
          "info",
          interaction.guild?.iconURL(),
        ),
      ],
      components: staffRow ? [staffRow] : [],
    });
  });
}

async function handleUserStats(bot: Bot, interaction: ButtonInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const discordId = interaction.customId.slice("usr-stats-".length);
  const client = await requireInstallation(bot, interaction);
  if (!client) return;
  await withEngineErrors(interaction, async () => {
    const stats = await fetchMemberStats(
      client,
      { window: "all_time" },
      interactionActor(interaction),
      discordId,
    );
    if (!stats) {
      await interaction.editReply(errors.UserStatsFetchError);
      return;
    }
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [buildEngineMemberStatsContainer(stats)],
    });
  });
}

/**
 * Handles the buttons that have an engine implementation. Returns false for
 * buttons that don't touch event data (bookmarks, QOTD, pagination), which
 * the regular handler processes.
 *
 * @param bot The bot instance.
 * @param interaction The button interaction.
 * @returns True when the button was handled.
 */
export async function processEngineButtonClick(
  bot: Bot,
  interaction: ButtonInteraction,
): Promise<boolean> {
  const id = interaction.customId;
  if (id.startsWith("er-") || id.startsWith("ea-")) {
    await handleParticipationButton(bot, interaction);
  } else if (id.startsWith("evt-join-")) {
    await handleListInterest(bot, interaction, true);
  } else if (id.startsWith("evt-leave-")) {
    await handleListInterest(bot, interaction, false);
  } else if (id.startsWith("evt-approve-")) {
    await handleTransition(bot, interaction, "approved");
  } else if (id.startsWith("evt-reject-")) {
    await handleTransition(bot, interaction, "rejected");
  } else if (id.startsWith("evt-info-")) {
    await handleInfo(bot, interaction);
  } else if (id.startsWith("evt-addpts-")) {
    await handleEngineParticipantButton(bot, interaction, "add");
  } else if (id.startsWith("evt-rmpts-")) {
    await handleEngineParticipantButton(bot, interaction, "remove");
  } else if (id.startsWith(OPENLIBRARY_BR_BUTTON_PREFIX)) {
    await handleEngineBookRequestButton(bot, interaction);
  } else if (id.startsWith("usr-stats-")) {
    await handleUserStats(bot, interaction);
  } else {
    return false;
  }
  return true;
}
