import { hideLinkEmbed } from "discord.js";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * Fetches a single book link from GR.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleLink: CommandHandler = async (bot, interaction) => {
  try {
    const query = interaction.options.getString("query", true);
    const isEphemeral = interaction.options.getBoolean("ephemeral") ?? true;
    await interaction.deferReply({ ephemeral: isEphemeral });

    const response = await bot.api.goodreads.goodreadsControllerSearchBooks({
      q: query,
      k: 1,
    });

    await interaction.editReply({
      content: hideLinkEmbed(response.data[0].url),
    });
  } catch (err) {
    const error = err as Error;
    if (error.message === "Request failed with status code 404") {
      await interaction.editReply(errors.NoBooksFoundError);
    } else {
      await interaction.editReply(errors.SomethingWentWrongError);
      await errorHandler(
        bot,
        "commands > goodreads > link",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  }
};
