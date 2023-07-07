import { CommandHandler } from "../../../models";
import { logger } from "../../../utils/logHandler";

/**
 * Replies to the user with 'Pong!'.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handlePing: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.reply("Pong!");
  } catch (err) {
    logger.error(err, `Error in handlePing`);
    await interaction.reply("Something went wrong! Please try again later.");
  }
};
