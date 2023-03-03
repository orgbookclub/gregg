import {
  EventDocument,
  EventDtoStatusEnum,
  EventDtoTypeEnum,
} from "@orgbookclub/ows-client";
import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { getEventsListEmbed } from "../../../utils/eventUtils";
import { logger } from "../../../utils/logHandler";
import { PaginationManager } from "../../../utils/paginationUtils";

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
    const query = interaction.options.getString("query", true);
    const eventType = interaction.options.getString(
      "type",
      true,
    ) as keyof typeof EventDtoTypeEnum;
    const eventStatus = interaction.options.getString(
      "status",
      true,
    ) as keyof typeof EventDtoStatusEnum;
    const response = await bot.api.events.eventsControllerFind({
      bookSearchQuery: query,
      status: eventStatus,
      type: eventType,
    });
    const pageSize = 5;
    const pagedContentManager = new PaginationManager<EventDocument>(
      pageSize,
      response.data,
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
