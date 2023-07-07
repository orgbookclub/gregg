import {
  EventDocument,
  EventDtoStatusEnum,
  EventDtoTypeEnum,
} from "@orgbookclub/ows-client";

import { CommandHandler } from "../../../models";
import { getEventsListEmbed } from "../../../utils/eventUtils";
import { logger } from "../../../utils/logHandler";
import { PaginationManager } from "../../../utils/paginationManager";

/**
 * Returns a list of events for the given query string.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleSearch: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();
    const query = interaction.options.getString("query", true);
    const eventType = interaction.options.getString("type");
    const eventStatus = interaction.options.getString("status");

    const response = await bot.api.events.eventsControllerFind({
      bookSearchQuery: query,
      status: eventStatus
        ? (eventStatus as keyof typeof EventDtoStatusEnum)
        : undefined,
      type: eventType
        ? (eventType as keyof typeof EventDtoTypeEnum)
        : undefined,
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
    pagedContentManager.createCollectors(message, interaction, 5 * 60 * 1000);
  } catch (err) {
    logger.error(err, `Error in handleSearch`);
    await interaction.reply("Something went wrong! Please try again later");
  }
};
