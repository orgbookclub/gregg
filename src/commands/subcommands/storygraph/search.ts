import { ChatInputCommandInteraction } from "discord.js";

import { errors } from "../../../config/constants";
import { CommandHandler, Bot } from "../../../models";
import { getBookSearchEmbed } from "../../../utils/bookUtils";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * Fetches a list of book links from SG.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleSearch: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const query = interaction.options.getString("query", true);
    const limit = interaction.options.getInteger("limit") ?? 5;
    const isEphemeral = interaction.options.getBoolean("ephemeral") ?? true;
    await interaction.deferReply({ ephemeral: isEphemeral });

    const response = await bot.api.storygraph.storygraphControllerSearchBooks({
      q: query,
      k: limit,
    });

    const embed = getBookSearchEmbed(query, response.data, "Storygraph");
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    const error = err as Error;
    if (error.message === "Request failed with status code 404") {
      await interaction.editReply(errors.NoBooksFoundError);
    } else {
      await interaction.editReply(errors.SomethingWentWrongError);
      await errorHandler(
        bot,
        "commands > storygraph > search",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  }
};

export { handleSearch };
