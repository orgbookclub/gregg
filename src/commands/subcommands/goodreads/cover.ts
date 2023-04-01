import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from "../../../models/Bot";
import { CommandHandler } from "../../../models/CommandHandler";
import { logger } from "../../../utils/logHandler";

/**
 * Returns the book cover from GR.
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
      await bot.api.goodreads.goodreadsControllerSearchAndGetBook({ q: query });
    await interaction.editReply({ content: response.data.coverUrl });
  } catch (err) {
    logger.error(`Error in handleCover: ${err}`);
  }
};
