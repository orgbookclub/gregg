import {
  EventDocument,
  EventsV2ControllerFindSortByEnum,
  EventsV2ControllerFindStatusEnum,
  EventsV2ControllerFindTypeEnum,
} from "@organizedbookclub/ows-client";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import { EVENT_LIST_FIELDS, findEventsPage } from "../../../utils/eventsApi";
import { getEventsListContainer } from "../../../utils/eventUtils";
import { LazyPaginationManager } from "../../../utils/lazyPaginationManager";

const UI_PAGE_SIZE = 4;
const API_PAGE_SIZE = 20;

/**
 * Returns a list of events.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleList: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();
    const eventType = interaction.options.getString(
      "type",
      true,
    ) as EventsV2ControllerFindTypeEnum;
    const eventStatus = interaction.options.getString(
      "status",
      true,
    ) as EventsV2ControllerFindStatusEnum;
    const eventSortOrder = interaction.options.getString(
      "sort",
      false,
    ) as EventsV2ControllerFindSortByEnum | null;
    const sortBy: EventsV2ControllerFindSortByEnum =
      eventSortOrder ?? "startDateDesc";

    const filters = { status: eventStatus, type: eventType };
    const first = await findEventsPage(
      bot,
      filters,
      EVENT_LIST_FIELDS,
      sortBy,
      1,
      API_PAGE_SIZE,
    );
    if (first.total === 0) {
      await interaction.editReply(
        "There are no events to display with the given filters",
      );
      return;
    }

    const pagedContentManager = new LazyPaginationManager<EventDocument>(
      UI_PAGE_SIZE,
      API_PAGE_SIZE,
      first.total,
      first.items,
      bot,
      (title, values, ix, pageInfo) =>
        getEventsListContainer(
          title,
          values,
          ix,
          false,
          `${eventType} · ${eventStatus}`,
          pageInfo,
        ),
      async (apiPage) => {
        const res = await findEventsPage(
          bot,
          filters,
          EVENT_LIST_FIELDS,
          sortBy,
          apiPage,
          API_PAGE_SIZE,
        );
        return res.items;
      },
      "Events",
    );
    const message = await interaction.editReply(
      pagedContentManager.createMessagePayloadForPage(interaction),
    );
    pagedContentManager.createCollectors(message, interaction, 5 * 60 * 1000);
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > events > list",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
