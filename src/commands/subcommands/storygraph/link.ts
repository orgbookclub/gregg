import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * Fetches a single book link from SG.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleLink: CommandHandler = async (bot, interaction) => {
  try {
    const query = interaction.options.getString("query", true);
    const isEphemeral = interaction.options.getBoolean("ephemeral") ?? true;
    await interaction.deferReply({ ephemeral: isEphemeral });

    const response = await bot.api.storygraph.storygraphControllerSearchBooks({
      q: query,
      k: 1,
    });

    await interaction.editReply({ content: response.data[0].url });
  } catch (err) {
    const error = err as Error;
    if (error.message === "Request failed with status code 404") {
      await interaction.editReply(errors.NoBooksFoundError);
    } else {
      await interaction.editReply(errors.SomethingWentWrongError);
      await errorHandler(
        bot,
        "commands > storygraph > link",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  }
};
