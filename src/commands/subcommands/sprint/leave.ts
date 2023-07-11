import { userMention } from "discord.js";

import { CommandHandler } from "../../../models";
import { SprintStatus } from "../../../models/commands/sprint/SprintStatus";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * Enables a user to leave an ongoing sprint.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleLeave: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();

    const threadId = interaction.channelId;
    const user = interaction.user;
    if (!bot.sprintManager.isSprintPresent(threadId, SprintStatus.Ongoing)) {
      await interaction.editReply({
        content: "There are no ongoing sprints to leave in this thread!",
      });
      return;
    }
    bot.sprintManager.removeUserFromSprint(threadId, user.id);
    await interaction.editReply({
      content: `${userMention(user.id)} has left the sprint`,
    });
  } catch (err) {
    await interaction.editReply("Something went wrong! Please try again later");
    await errorHandler(
      bot,
      "commands > sprint > leave",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
