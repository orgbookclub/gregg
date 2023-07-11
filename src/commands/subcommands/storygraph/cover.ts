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
    const isephemeral = interaction.options.getBoolean("ephemeral") ?? true;
    await interaction.deferReply({ ephemeral: isephemeral });

    const response =
      await bot.api.storygraph.storygraphControllerSearchAndGetBook({
        q: query,
      });

    if (!response) {
      await interaction.editReply("No books found with that query!");
    }

    await interaction.editReply({ content: response.data.coverUrl });
  } catch (err) {
    await interaction.editReply("Something went wrong! Please try again later");
    await errorHandler(
      bot,
      "commands > storygraph > cover",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
