import { errors, templates } from "../../../config/constants";
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
        content: errors.SprintAlreadyActiveError,
      });
      return;
    }
    if (!interaction.guild) {
      await interaction.editReply(errors.NotInGuildError);
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
        content: templates.sprintScheduled(duration, delay),
      });
    } else {
      await bot.sprintManager.startSprint(sprintId, bot);
      await interaction.editReply(templates.sprintStarted(duration));
    }
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > sprint > start",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
