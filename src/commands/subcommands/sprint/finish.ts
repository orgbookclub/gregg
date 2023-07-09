import { CommandHandler } from "../../../models";
import { SprintStatus } from "../../../models/commands/sprint/SprintStatus";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * Enables a user to log their count at the end of a sprint.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleFinish: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply({ ephemeral: true });

    const count = interaction.options.getInteger("count") ?? 0;

    const threadId = interaction.channelId;
    const user = interaction.user;
    if (!bot.sprintManager.isSprintPresent(threadId, SprintStatus.Finished)) {
      await interaction.editReply({
        content:
          "There are no finished sprints to log end counts in this thread!",
      });
      return;
    }

    // const sprint = bot.dataCache.sprintManager.getSprint(threadId);
    const participants = bot.sprintManager.getSprintParticipants(threadId);
    if (!participants[user.id]) {
      await interaction.editReply({
        content: "You were not a participant of this sprint!",
      });
      return;
    }
    bot.sprintManager.logEndCount(threadId, user.id, count);
    await interaction.editReply({
      content: `Successfully logged your end count as ${count}!`,
    });
  } catch (err) {
    await interaction.editReply("Something went wrong! Please try again later");
    await errorHandler(
      bot,
      "commands > sprint > finish",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
