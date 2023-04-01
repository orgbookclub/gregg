import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from "../../../models/Bot";
import { CommandHandler } from "../../../models/CommandHandler";
import { SprintStatus } from "../../../models/SprintStatus";
import { logger } from "../../../utils/logHandler";

/**
 * Gets the status of the current ongoing sprint in the current channel/thread.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleStatus: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const threadId = interaction.channelId;
    if (
      !bot.dataCache.sprintManager.isSprintPresent(
        threadId,
        SprintStatus.Scheduled,
      ) &&
      !bot.dataCache.sprintManager.isSprintPresent(
        threadId,
        SprintStatus.Ongoing,
      )
    ) {
      await interaction.editReply({
        content: "There are no active sprints in this thread!",
      });
      return;
    }
    const sprint = bot.dataCache.sprintManager.getSprint(threadId);
    await interaction.editReply({
      content: sprint.getStatusMessage(),
    });
  } catch (err) {
    logger.error(`Error in handleStatus: ${err}`);
  }
};
