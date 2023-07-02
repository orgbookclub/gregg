import { ChatInputCommandInteraction } from "discord.js";

import { CommandHandler, Bot } from "../../../models";
import { logger } from "../../../utils/logHandler";

/**
 * Gets a random GR quote.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleQuote: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const query = interaction.options.getString("query", true);
    const response = await bot.api.goodreads.goodreadsControllerGetQuotes({
      q: query,
    });
    let quote = response.data[0];
    if (quote.length >= 2000) {
      quote = quote.substring(0, 1995) + "...";
    }
    await interaction.editReply({ content: quote });
  } catch (err) {
    logger.error(err, `Error in handleQuote`);
  }
};
