import {
  EventDocument,
  EventsV2ControllerFindStatusEnum,
  EventsV2ControllerFindTypeEnum,
} from "@organizedbookclub/ows-client";
import { ChatInputCommandInteraction } from "discord.js";

import { errors, templates } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import { EVENT_LIST_FIELDS, findEventsPage } from "../../../utils/eventsApi";
import { getEventsListContainer } from "../../../utils/eventUtils";
import { LazyPaginationManager } from "../../../utils/lazyPaginationManager";

const UI_PAGE_SIZE = 4;
const API_PAGE_SIZE = 20;

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

    const filters = {
      bookSearchQuery: query,
      status: eventStatus
        ? (eventStatus as EventsV2ControllerFindStatusEnum)
        : undefined,
      type: eventType
        ? (eventType as EventsV2ControllerFindTypeEnum)
        : undefined,
    };

    const first = await findEventsPage(
      bot,
      filters,
      EVENT_LIST_FIELDS,
      undefined,
      1,
      API_PAGE_SIZE,
    );
    if (first.total === 0) {
      await interaction.editReply(templates.noEventsForQuery(query));
      return;
    }

    const pagedContentManager = new LazyPaginationManager<EventDocument>(
      UI_PAGE_SIZE,
      API_PAGE_SIZE,
      first.total,
      first.items,
      bot,
      (
        title: string,
        values: EventDocument[],
        ix: ChatInputCommandInteraction,
        pageInfo: { current: number; total: number },
      ) =>
        getEventsListContainer(title, values, ix, true, `"${query}"`, pageInfo),
      async (apiPage) => {
        const res = await findEventsPage(
          bot,
          filters,
          EVENT_LIST_FIELDS,
          undefined,
          apiPage,
          API_PAGE_SIZE,
        );
        return res.items;
      },
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
