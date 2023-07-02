import { ChatInputCommandInteraction } from "discord.js";

import { CommandHandler, Bot } from "../../../models";
import { logger } from "../../../utils/logHandler";

/**
 * Replies to the user with 'Pong!'.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handlePing: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    await interaction.reply("Pong!");
  } catch (err) {
    logger.error(err, `Error in handlePing`);
  }
};
