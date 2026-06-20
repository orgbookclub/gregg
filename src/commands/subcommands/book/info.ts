import { MessageFlags } from "discord.js";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { getOpenLibraryBookComponents } from "../../../utils/bookUtils";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * Fetches details of a book from Open Library.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleInfo: CommandHandler = async (bot, interaction) => {
  try {
    const query = interaction.options.getString("query", true);
    const isEphemeral = interaction.options.getBoolean("ephemeral") ?? false;
    await interaction.deferReply({ ephemeral: isEphemeral });

    const response =
      await bot.api.openLibrary.openLibraryControllerSearchAndGetBook({
        q: query,
      });

    const components = getOpenLibraryBookComponents(response.data);
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components,
    });
  } catch (err) {
    const error = err as Error;
    if (error.message === "Request failed with status code 404") {
      await interaction.editReply(errors.NoBooksFoundError);
    } else {
      await interaction.editReply(errors.SomethingWentWrongError);
      await errorHandler(
        bot,
        "commands > book > info",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  }
};

export { handleInfo };
