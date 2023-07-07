import { userMention } from "discord.js";

import { CommandHandler } from "../../../models";
import { SprintStatus } from "../../../models/commands/sprint/SprintStatus";
import { logger } from "../../../utils/logHandler";

/**
 * Enables a user to leave an ongoing sprint.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleLeave: CommandHandler = async (bot, interaction) => {
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
        content: "There are no ongoing sprints to leave in this thread!",
      });
      return;
    }
    const sprint = bot.dataCache.sprintManager.getSprint(threadId);
    sprint.leave(user.id);
    await interaction.editReply({
      content: `${userMention(user.id)} has left the sprint`,
    });
  } catch (err) {
    logger.error(err, `Error in handleLeave`);
    await interaction.editReply("Something went wrong! Please try again later");
  }
};
