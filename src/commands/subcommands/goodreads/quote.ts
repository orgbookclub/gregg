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
    const isephemeral = interaction.options.getBoolean("ephemeral") ?? true;
    await interaction.deferReply({ ephemeral: isephemeral });

    const response = await bot.api.goodreads.goodreadsControllerGetQuotes({
      q: query,
      k: 20,
    });
    if (!response || response.data.length === 0) {
      await interaction.editReply("No quotes found with that query!");
      return;
    }

    const quotes = response.data[0];
    let randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    randomQuote = customSubstring(randomQuote, 2000);
    await interaction.editReply({ content: randomQuote });
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
