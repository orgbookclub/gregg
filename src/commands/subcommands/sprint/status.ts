import { CommandHandler } from "../../../models/commands/CommandHandler";
import { SprintStatus } from "../../../models/commands/sprint/SprintStatus";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * Gets the status of the current ongoing sprint in the current channel/thread.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleStatus: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();

    const threadId = interaction.channelId;
    if (
      !bot.sprintManager.isSprintPresent(threadId, SprintStatus.Scheduled) &&
      !bot.sprintManager.isSprintPresent(threadId, SprintStatus.Ongoing) &&
      !bot.sprintManager.isSprintPresent(threadId, SprintStatus.Finished)
    ) {
      await interaction.editReply({
        content: "There are no ongoing sprints in this thread!",
      });
      return;
    }
    await interaction.editReply({
      content: bot.sprintManager.getSprintStatus(threadId),
    });
  } catch (err) {
    await interaction.editReply("Something went wrong! Please try again later");
    errorHandler(
      bot,
      "commands > sprint > status",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
