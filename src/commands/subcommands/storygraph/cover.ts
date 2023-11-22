import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * Fetches cover of a book from SG.
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
      await bot.api.storygraph.storygraphControllerSearchAndGetBook({
        q: query,
      });

    await interaction.editReply({ content: response.data.coverUrl });
  } catch (err) {
    const error = err as Error;
    if (error.message === "Request failed with status code 404") {
      await interaction.editReply(errors.NoBooksFoundError);
    } else {
      await interaction.editReply(errors.SomethingWentWrongError);
      await errorHandler(
        bot,
        "commands > storygraph > cover",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  }
};
