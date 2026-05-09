import {
  EventDocument,
  EventDtoStatusEnum,
  EventDtoTypeEnum,
} from "@orgbookclub/ows-client";
import { ChatInputCommandInteraction } from "discord.js";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import { getEventsListContainer } from "../../../utils/eventUtils";
import { PaginationManagerV2 } from "../../../utils/paginationManagerV2";

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
    if (response.data.length === 0) {
      await interaction.editReply(`No events found for "${query}".`);
      return;
    }
    const pageSize = 4;
    const pagedContentManager = new PaginationManagerV2<EventDocument>(
      pageSize,
      response.data,
      bot,
      (
        title: string,
        values: EventDocument[],
        ix: ChatInputCommandInteraction,
        pageInfo: { current: number; total: number },
      ) =>
        getEventsListContainer(title, values, ix, true, `"${query}"`, pageInfo),
      `Event Search`,
    );
    const message = await interaction.editReply(
      pagedContentManager.createMessagePayloadForPage(interaction),
    );
    pagedContentManager.createCollectors(message, interaction, 5 * 60 * 1000);
  } catch (err) {
    await interaction.reply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > events > search",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
