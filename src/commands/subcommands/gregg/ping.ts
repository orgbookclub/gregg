import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";

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
    await interaction.reply("Something went wrong! Please try again later.");
    await errorHandler(
      bot,
      "commands > gregg > ping",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
