import { ChatInputCommandInteraction } from "discord.js";

import { CommandHandler, Bot } from "../../../models";
import { logger } from "../../../utils/logHandler";

/**
 * Returns the book cover from SG.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleCover: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const query = interaction.options.getString("query", true);
    const response =
      await bot.api.storygraph.storygraphControllerSearchAndGetBook({
        q: query,
      });
    await interaction.editReply({ content: response.data.coverUrl });
  } catch (err) {
    logger.error(err, `Error in handleCover`);
  }
};
