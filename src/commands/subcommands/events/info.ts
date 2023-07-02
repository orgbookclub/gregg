import { ChatInputCommandInteraction } from "discord.js";

import { Bot, CommandHandler } from "../../../models";
import { getEventInfoEmbed } from "../../../utils/eventUtils";
import { logger } from "../../../utils/logHandler";

/**
 * Shows detailed information for an event.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleInfo: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    await interaction.deferReply();
    const id = interaction.options.getString("id", true);
    const response = await bot.api.events.eventsControllerFindOne({ id: id });
    const embed = getEventInfoEmbed(response.data, bot, interaction);
    await interaction.editReply({
      embeds: [embed],
    });
  } catch (err) {
    logger.error(err, `Error in handleInfo`);
  }
};
