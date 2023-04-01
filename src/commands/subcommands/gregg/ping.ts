import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from "../../../models/Bot";
import { CommandHandler } from "../../../models/CommandHandler";
import { errorHandler } from "../../../utils/errorHandler";
import { logger } from "../../../utils/logHandler";

/**
 * Replies to the user with 'Pong!'.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handlePing: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    await interaction.reply("Pong!");
  } catch (err) {
    await errorHandler(
      bot,
      "ping command",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
    logger.error(`Error in handlePing: ${err}`);
  }
};
