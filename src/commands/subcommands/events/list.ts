import {
  EventDocument,
  EventDtoStatusEnum,
  EventDtoTypeEnum,
} from "@orgbookclub/ows-client";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import { getEventsListEmbed } from "../../../utils/eventUtils";
import { PaginationManager } from "../../../utils/paginationManager";

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
    ) as keyof typeof EventDtoTypeEnum;
    const eventStatus = interaction.options.getString(
      "status",
      true,
    ) as keyof typeof EventDtoStatusEnum;

    let eventList: EventDocument[];
    try {
      const response = await bot.api.events.eventsControllerFind({
        status: eventStatus,
        type: eventType,
      });
      eventList = response.data;
      if (eventList.length === 0) throw new Error();
    } catch (error) {
      await interaction.editReply(
        "There are no events to display with the given filters",
      );
      return;
    }
    const pageSize = 5;
    const pagedContentManager = new PaginationManager<EventDocument>(
      pageSize,
      eventList,
      bot,
      getEventsListEmbed,
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
