import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { logger } from "../../../utils/logHandler";

/**
 * Gets a random GR quote.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleQuote: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const query = interaction.options.getString("query", true);
    const response =
      await bot.apiClient.goodreadsApi.goodreadsControllerGetQuotes(query);
    await interaction.editReply({ content: response.data[0] });
  } catch (err) {
    logger.error(`Error in handleQuote: ${err}`);
  }
};
