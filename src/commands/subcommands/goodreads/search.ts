import { CommandHandler } from "../../../models";
import { getBookSearchEmbed } from "../../../utils/bookUtils";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * Fetches a list of book links from GR.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleSearch: CommandHandler = async (bot, interaction) => {
  try {
    const query = interaction.options.getString("query", true);
    const limit = interaction.options.getInteger("limit") ?? 5;
    const isephemeral = interaction.options.getBoolean("ephemeral") ?? true;
    await interaction.deferReply({ ephemeral: isephemeral });

    const response = await bot.api.goodreads.goodreadsControllerSearchBooks({
      q: query,
      k: limit,
    });

    if (!response || response.data.length === 0) {
      await interaction.editReply("No books found with that query!");
    }

    const embed = getBookSearchEmbed(query, response.data, "Goodreads");
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply("Something went wrong! Please try again later");
    await errorHandler(
      bot,
      "commands > goodreads > search",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

export { handleSearch };
