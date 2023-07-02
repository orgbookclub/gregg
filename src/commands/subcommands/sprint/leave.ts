import { ChatInputCommandInteraction } from "discord.js";

import { CommandHandler, Bot, SprintStatus } from "../../../models";
import { logger } from "../../../utils/logHandler";

/**
 * Enables a user to leave an ongoing sprint.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleLeave: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const threadId = interaction.channelId;
    const user = interaction.user;
    if (
      !bot.dataCache.sprintManager.isSprintPresent(
        threadId,
        SprintStatus.Ongoing,
      )
    ) {
      await interaction.editReply({
        content: "There are no active sprints to leave in this thread!",
      });
      return;
    }
    const sprint = bot.dataCache.sprintManager.getSprint(threadId);
    sprint.leave(user);
    await interaction.editReply({
      content: `Successfully left the sprint`,
    });
  } catch (err) {
    logger.error(err, `Error in handleLeave`);
  }
};
