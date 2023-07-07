import { userMention } from "discord.js";

import { CommandHandler } from "../../../models";
import { SprintStatus } from "../../../models/commands/sprint/SprintStatus";
import { logger } from "../../../utils/logHandler";

/**
 * Cancels an ongoing sprint.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleCancel: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();

    const threadId = interaction.channelId;
    const user = interaction.user;
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
    logger.error(err, `Error in handleCancel`);
    await interaction.editReply("Something went wrong! Please try again later");
  }
};
