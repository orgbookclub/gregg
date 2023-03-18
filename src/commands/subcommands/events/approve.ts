import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { logger } from "../../../utils/logHandler";

/**
 * Approves an event.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleApprove: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    await interaction.deferReply();
    const id = interaction.options.getString("id", true);
    /**
     * TODO: Incomplete command! Refactor
     * - Validate the id is of a valid event.
     * - Validate the event is in 'Requested' state.
     * - Possibly club this command with the event edit command
     *   or make a command to change the status of the event to other states than 'Approved'.
     */
    bot.emit("eventApprove", { id: id });
  } catch (err) {
    logger.error(`Error in handleApprove: ${err}`);
  }
};
