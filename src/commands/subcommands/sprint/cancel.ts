import { userMention } from "discord.js";

import { CommandHandler } from "../../../models";
import { SprintStatus } from "../../../models/commands/sprint/SprintStatus";
import { errorHandler } from "../../../utils/errorHandler";

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
      !bot.sprintManager.isSprintPresent(threadId, SprintStatus.Scheduled) &&
      !bot.sprintManager.isSprintPresent(threadId, SprintStatus.Ongoing)
    ) {
      await interaction.editReply({
        content: "There are no active sprints to cancel in this thread!",
      });
      return;
    }

    await bot.sprintManager.cancelSprint(threadId, bot);
    await interaction.editReply({
      content: `Sprint cancelled by ${userMention(user.id)}`,
    });
  } catch (err) {
    await interaction.editReply("Something went wrong! Please try again later");
    errorHandler(
      bot,
      "commands > sprint > cancel",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
