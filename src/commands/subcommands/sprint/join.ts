import { errors, templates } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { SprintStatus } from "../../../models/commands/sprint/SprintStatus";
import { errorHandler } from "../../../utils/errorHandler";

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

    if (!bot.sprintManager.isSprintPresent(threadId, SprintStatus.Ongoing)) {
      await interaction.editReply({
        content: errors.NoSprintToJoinError,
      });
      return;
    }
    bot.sprintManager.logStartCount(threadId, user.id, startCount);
    await interaction.editReply({
      content: templates.sprintJoined(user.id, startCount),
    });
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > sprint > join",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
