import { CommandHandler } from "../../../models";
import { SprintStatus } from "../../../models/commands/sprint/SprintStatus";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * Schedules a sprint to start in the current channel/thread.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleStart: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();

    const duration = interaction.options.getInteger("duration", true);
    const delay = interaction.options.getInteger("delay") ?? 0;

    const threadId = interaction.channelId;
    if (
      bot.sprintManager.isSprintPresent(threadId, SprintStatus.Scheduled) ||
      bot.sprintManager.isSprintPresent(threadId, SprintStatus.Ongoing) ||
      bot.sprintManager.isSprintPresent(threadId, SprintStatus.Finished)
    ) {
      await interaction.editReply({
        content:
          "There is already an active or scheduled sprint in this thread!",
      });
      return;
    }
    if (!interaction.guild) {
      await interaction.editReply("You are not in a guild!");
      return;
    }
    const sprintId = bot.sprintManager.createSprint(
      duration,
      interaction.guild?.id,
      threadId,
      interaction.user.id,
    );

    if (delay > 0) {
      bot.sprintManager.scheduleSprint(sprintId, bot, delay);
      await interaction.editReply({
        content: `Sprint of ${duration} minutes will start in ${delay} minute(s)!`,
      });
    } else {
      await bot.sprintManager.startSprint(sprintId, bot);
      await interaction.editReply(
        `Sprint of ${duration} minutes starting now!`,
      );
    }
  } catch (err) {
    await interaction.editReply("Something went wrong! Please try again later");
    errorHandler(
      bot,
      "commands > sprint > start",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
