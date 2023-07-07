import { ChatInputCommandInteraction } from "discord.js";

import { CommandHandler, Bot } from "../../../models";
import { getBookSearchEmbed } from "../../../utils/bookUtils";
import { logger } from "../../../utils/logHandler";

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
    const isEphermal = interaction.options.getBoolean("ephermal") ?? true;
    await interaction.deferReply({ ephemeral: isEphermal });

    const response = await bot.api.storygraph.storygraphControllerSearchBooks({
      q: query,
      k: limit,
    });

    if (!response || response.data.length === 0) {
      await interaction.editReply("No books found with that query!");
    }

    const embed = getBookSearchEmbed(query, response.data, "Storygraph");
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error(err, `Error in handleSearch`);
    await interaction.editReply("Something went wrong! Please try again later");
  }
};

export { handleSearch };
