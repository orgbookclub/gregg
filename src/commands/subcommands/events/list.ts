import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { EventDto } from "../../../providers/ows/dto/event.dto";
import { getEventsListEmbed } from "../../../utils/eventUtils";
import { logger } from "../../../utils/logHandler";
import { PaginationManager } from "../../../utils/paginationUtils";

/**
 * Returns a list of events.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleList: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const eventType = interaction.options.getString("type", true);
    const eventStatus = interaction.options.getString("status", true);
    const data = await bot.apiClient.getEventList(eventType, eventStatus);
    const pageSize = 5;
    const pagedContentManager = new PaginationManager<EventDto>(
      pageSize,
      data,
      bot,
      getEventsListEmbed,
    );
    const message = await interaction.editReply(
      pagedContentManager.createMessagePayloadForPage(interaction),
    );
    pagedContentManager.createCollectors(message, interaction, 120000);
  } catch (err) {
    logger.error(`Error in handleList: ${err}`);
  }
};
