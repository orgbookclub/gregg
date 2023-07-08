import { hideLinkEmbed } from "discord.js";

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
    const isEphermal = interaction.options.getBoolean("ephermal") ?? true;
    await interaction.deferReply({ ephemeral: isEphermal });

    const response = await bot.api.goodreads.goodreadsControllerSearchBooks({
      q: query,
      k: 1,
    });
    if (!response || response.data.length === 0) {
      await interaction.editReply("No books found with that query!");
    }
    await interaction.editReply({
      content: hideLinkEmbed(response.data[0].url),
    });
  } catch (err) {
    await interaction.editReply("Something went wrong! Please try again later");
    errorHandler(
      bot,
      "commands > goodreads > link",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
