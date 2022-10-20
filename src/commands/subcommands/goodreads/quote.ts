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
    const query = interaction.options.getString("query") ?? "";
    const data = await bot.apiClient.getGoodreadsQuote(query);
    logger.debug(data);
    await interaction.editReply({ content: data });
  } catch (err) {
    logger.error(`Error in handleQuote: ${err}`);
  }
};
