import { CommandHandler } from "../../../models/CommandHandler";
import { SprintStatus } from "../../../models/commands/sprint/SprintStatus";
import { logger } from "../../../utils/logHandler";

/**
 * Gets the status of the current ongoing sprint in the current channel/thread.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleStatus: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();

    const threadId = interaction.channelId;
    if (
      !bot.dataCache.sprintManager.isSprintPresent(
        threadId,
        SprintStatus.Scheduled,
      ) &&
      !bot.dataCache.sprintManager.isSprintPresent(
        threadId,
        SprintStatus.Ongoing,
      ) &&
      !bot.dataCache.sprintManager.isSprintPresent(
        threadId,
        SprintStatus.Finished,
      )
    ) {
      await interaction.editReply({
        content: "There are no ongoing sprints in this thread!",
      });
      return;
    }
    const sprint = bot.dataCache.sprintManager.getSprint(threadId);
    await interaction.editReply({
      content: sprint.getStatusMessage(),
    });
  } catch (err) {
    logger.error(err, `Error in handleStatus`);
    await interaction.editReply("Something went wrong! Please try again later");
  }
};
