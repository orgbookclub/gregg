import { MessageFlags } from "discord.js";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { getOpenLibraryBookSearchContainer } from "../../../utils/bookUtils";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * Fetches a list of book links from Open Library.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleSearch: CommandHandler = async (bot, interaction) => {
  try {
    const query = interaction.options.getString("query", true);
    const limit = interaction.options.getInteger("limit") ?? 5;
    const isEphemeral = interaction.options.getBoolean("ephemeral") ?? false;
    await interaction.deferReply({ ephemeral: isEphemeral });

    const response = await bot.api.openLibrary.openLibraryControllerSearchBooks(
      {
        q: query,
        k: limit,
      },
    );

    const container = getOpenLibraryBookSearchContainer(query, response.data);
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [container],
    });
  } catch (err) {
    const error = err as Error;
    if (error.message === "Request failed with status code 404") {
      await interaction.editReply(errors.NoBooksFoundError);
    } else {
      await interaction.editReply(errors.SomethingWentWrongError);
      await errorHandler(
        bot,
        "commands > book > search",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  }
};

export { handleSearch };
