import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { logger } from "../../../utils/logHandler";

/**
 * Approves and announces an event.
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
    bot.emit("eventApprove", { id: id });
  } catch (err) {
    logger.error(`Error in handleApprove: ${err}`);
  }
};
