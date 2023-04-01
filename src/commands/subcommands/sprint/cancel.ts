import { ChatInputCommandInteraction, userMention } from "discord.js";

import { Bot } from "../../../models/Bot";
import { CommandHandler } from "../../../models/CommandHandler";
import { SprintStatus } from "../../../models/SprintStatus";
import { logger } from "../../../utils/logHandler";

/**
 * Cancels an ongoing sprint.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleCancel: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const threadId = interaction.channelId;
    const user = interaction.user;
    if (
      bot.dataCache.sprintManager.isSprintPresent(
        threadId,
        SprintStatus.Scheduled,
      ) ||
      bot.dataCache.sprintManager.isSprintPresent(
        threadId,
        SprintStatus.Ongoing,
      )
    ) {
      await interaction.editReply({
        content: "There are no active sprints to cancel in this thread!",
      });
      return;
    }
    const sprint = bot.dataCache.sprintManager.getSprint(threadId);
    sprint.cancel();
    bot.dataCache.sprintManager.remove(sprint);
    await interaction.editReply({
      content: `Sprint cancelled by ${userMention(user.id)}`,
    });
  } catch (err) {
    logger.error(`Error in handleCancel ${err}`);
  }
};
