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
 * Gets the server event list for a user.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleEvents: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
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
    const userDto = userResponse.data;
    const userEventsResponse = await bot.api.events.eventsControllerFind({
      participantIds: [userDto._id],
      status: eventStatus,
      type: eventType,
    });
    const userEvents = userEventsResponse.data;
    if (userEvents.length === 0) {
      await interaction.editReply("No events found for given parameters");
      return;
    }
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
    logger.error(`Error in handleEvents ${err}`);
  }
};
