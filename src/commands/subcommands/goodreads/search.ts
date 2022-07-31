import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { Client } from "../../../providers/client";
import { logger } from "../../../utils/logHandler";

/**
 * Replies to the user with 'Pong!'.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleSearch: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const owsClient = new Client();
    const response = await owsClient.searchBooks(
      interaction.options.getString("query") ?? "",
      interaction.options.getInteger("k") ?? 1,
    );
    logger.debug(response.data);
    await interaction.editReply(JSON.stringify(response.data));
  } catch (err) {
    logger.error(`Error in handleSearch: ${err}`);
  }
};
