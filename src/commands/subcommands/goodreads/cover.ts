import { CommandHandler } from "../../../models";
import { logger } from "../../../utils/logHandler";

/**
 * Fetches cover of a book from GR.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleCover: CommandHandler = async (bot, interaction) => {
  try {
    const query = interaction.options.getString("query", true);
    const isEphermal = interaction.options.getBoolean("ephermal") ?? true;
    await interaction.deferReply({ ephemeral: isEphermal });

    const response =
      await bot.api.goodreads.goodreadsControllerSearchAndGetBook({ q: query });

    if (!response) {
      await interaction.editReply("No books found with that query!");
    }

    await interaction.editReply({ content: response.data.coverUrl });
  } catch (err) {
    logger.error(err, `Error in handleCover`);
    await interaction.editReply("Something went wrong! Please try again later");
  }
};
