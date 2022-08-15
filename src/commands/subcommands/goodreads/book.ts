import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { logger } from "../../../utils/logHandler";

/**
 * Gets the GR book information and returns an embed.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleBook: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const query = interaction.options.getString("query") ?? "";
    const data = await bot.apiClient.getGoodreadsBook(query);
    await interaction.editReply(JSON.stringify(data));
  } catch (err) {
    logger.error(`Error in handleBook: ${err}`);
  }
};
