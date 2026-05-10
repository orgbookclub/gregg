import { errors, messages } from "../../../config/constants";
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
    await interaction.reply(messages.Pong);
  } catch (err) {
    await interaction.reply(errors.SomethingWentWrongError);
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
