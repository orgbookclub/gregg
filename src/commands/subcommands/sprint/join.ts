import { userMention } from "discord.js";

import { CommandHandler } from "../../../models";
import { SprintStatus } from "../../../models/commands/sprint/SprintStatus";
import { logger } from "../../../utils/logHandler";

/**
 * Enables a user to join an ongoing sprint.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleJoin: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();

    const startCount = interaction.options.getInteger("count") ?? 0;

    const threadId = interaction.channelId;
    const user = interaction.user;

    if (
      !bot.dataCache.sprintManager.isSprintPresent(
        threadId,
        SprintStatus.Ongoing,
      )
    ) {
      await interaction.editReply({
        content:
          "There are no ongoing sprints to join in this thread!\nPlease start a sprint first to join it",
      });
      return;
    }

    const sprint = bot.dataCache.sprintManager.getSprint(threadId);
    sprint.join(user.id, startCount);
    await interaction.editReply({
      content: `${userMention(
        user.id,
      )} has successfully joined sprint with starting count of ${startCount}!`,
    });
  } catch (err) {
    logger.error(err, `Error in handleJoin`);
    await interaction.editReply("Something went wrong! Please try again later");
  }
};
