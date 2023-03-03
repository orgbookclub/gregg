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
    const eventType = interaction.options.getString(
      "type",
      true,
    ) as keyof typeof EventDtoTypeEnum;
    const eventStatus = interaction.options.getString(
      "status",
      true,
    ) as keyof typeof EventDtoStatusEnum;
    const response = await bot.apiClient.eventsApi.eventsControllerFind(
      undefined,
      undefined,
      undefined,
      undefined,
      eventStatus,
      eventType,
    );
    // const data = await bot.apiClient.getEventList(eventStatus, eventType);
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
    pagedContentManager.createCollectors(message, interaction, 120000);
  } catch (err) {
    logger.error(`Error in handleList: ${err}`);
  }
};
