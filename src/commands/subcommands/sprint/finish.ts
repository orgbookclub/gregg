import { MessageFlags } from "discord.js";

import { errors, templates } from "../../../config/constants";
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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const count = interaction.options.getInteger("count", true);

    const threadId = interaction.channelId;
    const user = interaction.user;
    if (!bot.sprintManager.isSprintPresent(threadId, SprintStatus.Finished)) {
      await interaction.editReply({
        content: errors.NoFinishedSprintError,
      });
      return;
    }

    // const sprint = bot.dataCache.sprintManager.getSprint(threadId);
    const participants = bot.sprintManager.getSprintParticipants(threadId);
    if (!participants[user.id]) {
      await interaction.editReply({
        content: errors.NotASprintParticipantError,
      });
      return;
    }
    bot.sprintManager.logEndCount(threadId, user.id, count);
    await interaction.editReply({
      content: templates.sprintFinishLogged(count),
    });
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
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
