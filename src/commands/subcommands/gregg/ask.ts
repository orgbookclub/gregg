import { MessageFlags } from "discord.js";

import { CommandHandler } from "../../../models";
import {
  AgentContext,
  SessionKey,
  deliverToInteraction,
  isAllowed,
} from "../../../modules/ai";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * One-shot AI agent invocation from a slash command. Mirrors the
 * mention-listener guard + delivery logic but uses `source: "slash"`,
 * which makes the SessionStore open a fresh, non-cached,
 * non-rehydrated session for this single turn. No conversation
 * history carries over; the agent answers exactly the question
 * asked and the session is closed when the turn ends.
 *
 * The reply is deferred (visible to the channel by default) before
 * calling the agent because Foundry responses regularly take 5-20s
 * and Discord requires interaction acknowledgement within 3s.
 *
 * @param bot The bot instance.
 * @param interaction The slash command interaction.
 * @param guildConfig The guild config, used to resolve the staff role.
 */
export const handleAsk: CommandHandler = async (
  bot,
  interaction,
  guildConfig,
) => {
  try {
    if (!interaction.inCachedGuild() || !bot.user) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const member = interaction.member;
    if (
      !isAllowed(member, {
        staffRoleId: guildConfig?.staffRole ?? "",
        betaRoleId: process.env.AI_BETA_ROLE_ID,
        devBypass: process.env.AI_DEV_BYPASS === "true",
      })
    ) {
      await interaction.reply({
        content:
          "Sorry, the AI assistant is in beta and not available to you yet.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!bot.ai) {
      await interaction.reply({
        content: "The AI assistant is currently disabled.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const query = interaction.options.getString("query", true);
    await interaction.deferReply();
    const sessionKey: SessionKey = {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      isThread: interaction.channel?.isThread() ?? false,
      userId: interaction.user.id,
    };
    const context: AgentContext = {
      source: "slash",
      sessionKey,
      member,
    };
    const result = await bot.ai.run(query, context);
    await deliverToInteraction(interaction, result);
  } catch (err) {
    await errorHandler(
      bot,
      "commands > gregg > ask",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
