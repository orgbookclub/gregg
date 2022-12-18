import { ChatInputCommandInteraction } from "discord.js";

import { SprintStatus } from "../../../classes/SprintStatus";
import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { logger } from "../../../utils/logHandler";

/**
 * Enables a user to log their count at the end of a sprint.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleFinish: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const count = interaction.options.getInteger("count") ?? 0;
    const threadId = interaction.channelId;
    const user = interaction.user;
    if (
      !bot.dataCache.sprintManager.isSprintPresent(
        threadId,
        SprintStatus.Finished,
      )
    ) {
      await interaction.editReply({
        content:
          "There are no finished sprints to log end counts in this thread!",
      });
      return;
    }
    const sprint = bot.dataCache.sprintManager.getSprint(threadId);
    if (!sprint.participants.has(user.id)) {
      await interaction.editReply({
        content: "You were not a participant of this sprint!",
      });
      return;
    }
    sprint.finish(user, count);
    await interaction.editReply({
      content: `Successfully logged end count: ${count}`,
    });
  } catch (err) {
    logger.error(`Error in handleFinish ${err}`);
  }
};
