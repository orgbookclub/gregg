import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalSubmitInteraction,
} from "discord.js";

import { Bot } from "../../../models";
import { actorFromDiscord } from "../actor";
import { EngineError, EngineInstallationClient } from "../client";
import { EngineActor } from "../types";

type AnyInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | ModalSubmitInteraction;

const NOT_LINKED_MESSAGE =
  "This server isn't linked to a club yet. A server admin can create a link code in the club's web settings and run `/link`.";

/**
 * Replies ephemerally, or edits the deferred reply.
 *
 * @param interaction The interaction.
 * @param content The message.
 */
export async function replyOrEdit(
  interaction: AnyInteraction,
  content: string,
): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content, embeds: [], components: [] });
  } else {
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
}

/**
 * Resolves the guild's installation client, replying with a hint when the
 * guild isn't linked.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 * @returns The installation client, or null after replying.
 */
export async function requireInstallation(
  bot: Bot,
  interaction: AnyInteraction,
): Promise<EngineInstallationClient | null> {
  const client =
    bot.engine && interaction.guildId
      ? await bot.engine.forGuild(interaction.guildId)
      : null;
  if (!client) await replyOrEdit(interaction, NOT_LINKED_MESSAGE);
  return client;
}

/**
 * Builds the engine actor for the user behind an interaction.
 *
 * @param interaction The interaction.
 * @returns The actor.
 */
export function interactionActor(interaction: AnyInteraction): EngineActor {
  return actorFromDiscord({
    user: interaction.user,
    member: interaction.member,
    guildId: interaction.guildId,
  });
}

/**
 * Turns expected engine refusals into a user-facing message. Returns null
 * for unexpected errors, which callers should rethrow.
 *
 * @param error The error.
 * @returns The message, or null.
 */
export function engineErrorMessage(error: unknown): string | null {
  if (!(error instanceof EngineError)) return null;
  switch (error.status) {
    case 400:
      return `The engine rejected that: ${error.detail ?? "invalid input"}.`;
    case 403:
      return "You don't have permission to do that for this club.";
    case 404:
      return "Not found. Check the ID and try again.";
    case 409:
    case 422:
      return (
        error.detail ?? "That isn't possible in the event's current state."
      );
    default:
      return null;
  }
}

export { NOT_LINKED_MESSAGE };
