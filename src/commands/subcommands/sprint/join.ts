import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from "../../../models/Bot";
import { CommandHandler } from "../../../models/CommandHandler";
import { SprintStatus } from "../../../models/SprintStatus";
import { logger } from "../../../utils/logHandler";

/**
 * Enables a user to join an ongoing sprint.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleJoin: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
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
        content: "There are no active sprints to join in this thread!",
      });
      return;
    }
    const sprint = bot.dataCache.sprintManager.getSprint(threadId);
    sprint.join(user, startCount);
    await interaction.editReply({
      content: `Successfully joined sprint with start count: ${startCount}`,
    });
  } catch (err) {
    logger.error(`Error in handleJoin ${err}`);
  }
};
