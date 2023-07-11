import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * Fetches cover of a book from GR.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleCover: CommandHandler = async (bot, interaction) => {
  try {
    const query = interaction.options.getString("query", true);
    const isEphemeral = interaction.options.getBoolean("ephemeral") ?? true;
    await interaction.deferReply({ ephemeral: isEphemeral });

    const response =
      await bot.api.goodreads.goodreadsControllerSearchAndGetBook({ q: query });

    if (!response) {
      await interaction.editReply("No books found with that query!");
    }

    await interaction.editReply({ content: response.data.coverUrl });
  } catch (err) {
    const error = err as Error;
    if (
      error.name === "AxiosError" &&
      error.message === "Request failed with status code 503"
    ) {
      await interaction.editReply(
        "Unfortunately, due to Goodreads being Goodreads, I cannot complete your request at the moment :(" +
          "\n" +
          "Please try again later, or use Storygraph instead �",
      );
    } else {
      await interaction.editReply(
        "Something went wrong! Please try again later",
      );
      await errorHandler(
        bot,
        "commands > goodreads > cover",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  }
};
