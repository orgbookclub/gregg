import {
  EventDocument,
  EventDtoStatusEnum,
  EventDtoTypeEnum,
} from "@orgbookclub/ows-client";

import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import { getEventsListEmbed } from "../../../utils/eventUtils";
import { PaginationManager } from "../../../utils/paginationManager";

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
    ) as keyof typeof EventDtoTypeEnum;
    const eventStatus = interaction.options.getString(
      "status",
      true,
    ) as keyof typeof EventDtoStatusEnum;

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
    const userEventsResponse = await bot.api.events.eventsControllerFind({
      participantIds: [userDoc._id],
      status: eventStatus,
      type: eventType,
    });
    if (!userEventsResponse || userEventsResponse.data.length === 0) {
      await interaction.editReply(
        "No events found for the user for the chosen options",
      );
      return;
    }
    const userEvents = userEventsResponse.data;
    const pageSize = 5;
    const pagedContentManager = new PaginationManager<EventDocument>(
      pageSize,
      userEvents,
      bot,
      getEventsListEmbed,
      `${user.username}'s Events | ${eventType} | ${eventStatus}`,
    );
    const message = await interaction.editReply(
      pagedContentManager.createMessagePayloadForPage(interaction),
    );
    pagedContentManager.createCollectors(message, interaction, 5 * 60 * 1000);
  } catch (err) {
    await interaction.editReply("Something went wrong! Please try again later");
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
