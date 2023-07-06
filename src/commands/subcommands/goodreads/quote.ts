import { CommandHandler } from "../../../models";
import { logger } from "../../../utils/logHandler";

/**
 * Fetches a random quote from GR.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleQuote: CommandHandler = async (bot, interaction) => {
  try {
    const query = interaction.options.getString("query", true);
    const isEphermal = interaction.options.getBoolean("ephermal") ?? true;
    await interaction.deferReply({ ephemeral: isEphermal });

    const response = await bot.api.goodreads.goodreadsControllerGetQuotes({
      q: query,
    });
    if (!response || response.data.length === 0) {
      await interaction.editReply("No quotes found with that query!");
    }

    let quote = response.data[0];
    if (quote.length >= 2000) {
      quote = quote.substring(0, 1995) + "...";
    }
    await interaction.editReply({ content: quote });
  } catch (err) {
    logger.error(err, `Error in handleQuote`);
    await interaction.editReply("Something went wrong! Please try again later");
  }
};
