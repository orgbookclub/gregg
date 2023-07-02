import { ChatInputCommandInteraction } from "discord.js";

import { CommandHandler, Bot } from "../../../models";
import { logger } from "../../../utils/logHandler";

/**
 * Returns the GR URL of the book.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleLink: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const query = interaction.options.getString("query", true);
    const response = await bot.api.goodreads.goodreadsControllerSearchBooks({
      q: query,
      k: 1,
    });
    await interaction.editReply({ content: response.data[0].url });
  } catch (err) {
    logger.error(err, `Error in handleLink`);
  }
};
