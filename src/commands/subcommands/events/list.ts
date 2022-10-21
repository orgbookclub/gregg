import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { logger } from "../../../utils/logHandler";

/**
 * Returns a list of events.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleList: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    // const eventType = interaction.options.getString("type", true);
    // const data = await bot.apiClient.
    await interaction.editReply({ content: "x" });
  } catch (err) {
    logger.error(`Error in handleList: ${err}`);
  }
};
