import { errors } from "../../../config/constants";
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
    const query = interaction.options.getString("query") ?? "";
    const isEphemeral = interaction.options.getBoolean("ephemeral") ?? true;
    await interaction.deferReply({ ephemeral: isEphemeral });

    const response = await bot.api.goodreads.goodreadsControllerGetQuotes({
      q: query,
      k: 20,
    });

    const quotes = response.data;
    let randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    randomQuote = customSubstring(randomQuote, 2000);
    await interaction.editReply({ content: randomQuote });
  } catch (err) {
    const error = err as Error;
    if (error.message === "Request failed with status code 404") {
      await interaction.editReply(errors.NoQuotesFoundError);
    } else {
      await interaction.editReply(errors.SomethingWentWrongError);
      await errorHandler(
        bot,
        "commands > goodreads > quote",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  }
};
