import {
  EventDocument,
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
 * Gets the server event list for a user.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleEvents: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();
    const user = interaction.options.getUser("user") ?? interaction.user;
    const eventType = interaction.options.getString(
      "type",
      true,
    ) as EventsV2ControllerFindTypeEnum;
    const eventStatus = interaction.options.getString(
      "status",
      true,
    ) as EventsV2ControllerFindStatusEnum;

    const userResponse = await bot.api.users.usersControllerFindOneByUserId({
      userid: user.id,
    });
    if (!userResponse) {
      await interaction.editReply(
        `No user found! Please check if the user ID ${user.id} is registered with the bot`,
      );
      return;
    }

    const userDoc = userResponse.data;
    const filters = {
      participantIds: [userDoc._id],
      status: eventStatus,
      type: eventType,
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
      await interaction.editReply(
        "No events found for the user for the chosen options",
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
          interaction.user.id,
        ),
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
      `${user.username}'s Events`,
    );
    const message = await interaction.editReply(
      pagedContentManager.createMessagePayloadForPage(interaction),
    );
    pagedContentManager.createCollectors(message, interaction, 5 * 60 * 1000);
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > user > events",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
