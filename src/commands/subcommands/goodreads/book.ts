import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { getGoodreadsBookEmbed } from "../../../utils/bookUtils";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * Fetches details of a book from GR.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleBook: CommandHandler = async (bot, interaction) => {
  try {
    const query = interaction.options.getString("query", true);
    const isEphemeral = interaction.options.getBoolean("ephemeral") ?? true;
    await interaction.deferReply({ ephemeral: isEphemeral });

    const response =
      await bot.api.goodreads.goodreadsControllerSearchAndGetBook({ q: query });

    const embed = getGoodreadsBookEmbed(response.data);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    const error = err as Error;
    if (
      error.name === "AxiosError" &&
      error.message === "Request failed with status code 503"
    ) {
      await interaction.editReply(errors.GoodreadsIssueError);
    } else if (error.message === "Request failed with status code 404") {
      await interaction.editReply(errors.NoBooksFoundError);
    } else {
      await interaction.editReply(errors.SomethingWentWrongError);
      await errorHandler(
        bot,
        "commands > goodreads > book",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  }
};

export { handleBook };
