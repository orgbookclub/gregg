import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import { customSubstring } from "../../../utils/stringUtils";

/**
 * Fetches a random quote from GR.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleQuote: CommandHandler = async (bot, interaction) => {
  try {
    const query = interaction.options.getString("query", true);
    const isephemeral = interaction.options.getBoolean("ephemeral") ?? true;
    await interaction.deferReply({ ephemeral: isephemeral });

    const response = await bot.api.goodreads.goodreadsControllerGetQuotes({
      q: query,
    });
    if (!response || response.data.length === 0) {
      await interaction.editReply("No quotes found with that query!");
      return;
    }

    let quote = response.data[0];
    if (quote.length >= 2000) {
      quote = customSubstring(quote, 2000);
    }
    await interaction.editReply({ content: quote });
  } catch (err) {
    await interaction.editReply("Something went wrong! Please try again later");
    await errorHandler(
      bot,
      "commands > goodreads > quote",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
