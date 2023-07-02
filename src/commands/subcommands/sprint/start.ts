import { ChatInputCommandInteraction } from "discord.js";

import { CommandHandler, Bot, SprintStatus, Sprint } from "../../../models";
import { logger } from "../../../utils/logHandler";

/**
 * Schedules a sprint to start in the current channel/thread.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleStart: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
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
    const sprint = new Sprint(duration, delay, threadId);
    bot.dataCache.sprintManager.add(sprint);
    bot.emit("sprintSchedule", sprint, delay);
    await interaction.editReply({
      content: `A Sprint of ${duration} minutes will start in ${delay} minutes!`,
    });
  } catch (err) {
    logger.error(err, `Error in handleStart`);
  }
};
