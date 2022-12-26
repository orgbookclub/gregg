import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { EventDto } from "../../../providers/ows/dto/event.dto";
import { getEventsListEmbed } from "../../../utils/eventUtils";
import { logger } from "../../../utils/logHandler";
import { PaginationManager } from "../../../utils/paginationManager";

/**
 * Returns a list of events for the given query string.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleSearch: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    await interaction.deferReply();
    const query = interaction.options.getString("query", true);
    const eventType = interaction.options.getString("type") ?? undefined;
    const eventStatus = interaction.options.getString("status") ?? undefined;
    const data = await bot.apiClient.searchEvents(
      query,
      eventType,
      eventStatus,
    );
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
    pagedContentManager.createCollectors(message, interaction, 60000);
  } catch (err) {
    logger.error(`Error in handleSearch: ${err}`);
  }
};
