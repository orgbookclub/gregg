import { CommandHandler } from "../../../models";
import { Sprint } from "../../../models/commands/sprint/Sprint";
import { SprintStatus } from "../../../models/commands/sprint/SprintStatus";
import { logger } from "../../../utils/logHandler";

/**
 * Schedules a sprint to start in the current channel/thread.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleStart: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();

    const duration = interaction.options.getInteger("duration", true);
    const delay = interaction.options.getInteger("delay") ?? 0;

    const threadId = interaction.channelId;
    if (
      bot.dataCache.sprintManager.isSprintPresent(
        threadId,
        SprintStatus.Scheduled,
      ) ||
      bot.dataCache.sprintManager.isSprintPresent(
        threadId,
        SprintStatus.Ongoing,
      ) ||
      bot.dataCache.sprintManager.isSprintPresent(
        threadId,
        SprintStatus.Finished,
      )
    ) {
      await interaction.editReply({
        content:
          "There is already an active or scheduled sprint in this thread!",
      });
      return;
    }
    const sprint = new Sprint(duration, threadId, interaction.user.id);
    bot.dataCache.sprintManager.add(sprint);
    if (delay > 0) {
      bot.emit("sprintSchedule", sprint.threadId, delay);
      await interaction.editReply({
        content: `Sprint of ${duration} minutes will start in ${delay} minute(s)!`,
      });
    } else {
      bot.emit("sprintStart", sprint.threadId, delay);
      await interaction.editReply(
        `Sprint of ${duration} minutes starting now!`,
      );
    }
  } catch (err) {
    logger.error(err, `Error in handleStart`);
    await interaction.editReply("Something went wrong! Please try again later");
  }
};
