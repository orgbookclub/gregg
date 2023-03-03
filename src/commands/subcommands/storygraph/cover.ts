import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { logger } from "../../../utils/logHandler";

/**
 * Returns the book cover from SG.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleCover: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const query = interaction.options.getString("query", true);
    const response =
      await bot.api.storygraph.storygraphControllerSearchAndGetBook(
        query,
      );
    await interaction.editReply({ content: response.data.coverUrl });
  } catch (err) {
    logger.error(`Error in handleCover: ${err}`);
  }
};
