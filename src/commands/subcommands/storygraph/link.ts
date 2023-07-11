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

    if (!response) {
      await interaction.editReply("No books found with that query!");
    }

    await interaction.editReply({ content: response.data[0].url });
  } catch (err) {
    await interaction.editReply("Something went wrong! Please try again later");
    await errorHandler(
      bot,
      "commands > storygraph > link",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
