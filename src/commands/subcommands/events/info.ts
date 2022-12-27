import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { getEventInfoEmbed } from "../../../utils/eventUtils";
import { logger } from "../../../utils/logHandler";

/**
 * Shows detailed information for an event.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleInfo: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    await interaction.deferReply();
    const id = interaction.options.getString("id", true);
    const data = await bot.apiClient.getEventInfo(id);
    const embed = getEventInfoEmbed(data, bot, interaction);
    await interaction.editReply({
      embeds: [embed],
    });
  } catch (err) {
    logger.error(`Error in handleInfo: ${err}`);
  }
};
