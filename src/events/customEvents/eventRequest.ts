import { ButtonBuilder } from "@discordjs/builders";
import { CreateEventDto, EventDocumentTypeEnum } from "@orgbookclub/ows-client";
import { ActionRowBuilder, ButtonStyle, TextChannel } from "discord.js";

import { ChannelIds } from "../../config";
import { Bot, Event } from "../../models";
import { getEventRequestEmbed } from "../../utils/eventUtils";
import { logger } from "../../utils/logHandler";

interface EventRequestEventDto {
  url: string;
  createEventDto: CreateEventDto;
}

const eventRequest: Event = {
  name: "eventRequest",
  run: async (bot: Bot, eventRequestDto: EventRequestEventDto) => {
    try {
      logger.debug(
        `eventRequest event fired: ${JSON.stringify(eventRequestDto)}`,
      );
      const response = await bot.api.events.eventsControllerCreateFromUrl({
        url: eventRequestDto.url,
        createEventDto: eventRequestDto.createEventDto,
      });
      const eventResponse = await bot.api.events.eventsControllerFindOne({
        id: response.data._id,
      });
      const event = eventResponse.data;
      logger.debug(`event created: ${JSON.stringify(event)}`);

      if (event.type === EventDocumentTypeEnum.BuddyRead) {
        const channelId = ChannelIds.BRRequestChannel;
        const embed = await getEventRequestEmbed(event, bot);
        const channel = await bot.channels.fetch(channelId);
        if (channel === null || !channel.isTextBased()) {
          throw new Error("Unable to post event request in given channel");
        }

        const buttonActionRow = getButtonActionRow(event._id);
        await (channel as TextChannel).send({
          embeds: [embed],
          components: [buttonActionRow],
        });
      }
      // TODO: send DM to event leader with guidelines
      // TODO: Figure out how to get participants interested in the event
    } catch (err) {
      logger.error(err, `Error while handling eventRequest event`);
    }
  },
};

function getButtonActionRow(eventId: string) {
  const interestedButton = new ButtonBuilder()
    .setEmoji({ name: "✅" })
    .setStyle(ButtonStyle.Success)
    .setCustomId(`er-${eventId}-interested`);
  const notInterestedButton = new ButtonBuilder()
    .setEmoji({ name: "❌" })
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(`er-${eventId}-notInterested`);
  const buttonActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    interestedButton,
    notInterestedButton,
  );
  return buttonActionRow;
}
export { eventRequest };
