import {
  CreateEventDto,
  EventDocument,
  EventDocumentTypeEnum,
} from "@orgbookclub/ows-client";
import { Colors, EmbedBuilder, TextChannel, userMention } from "discord.js";

import { ChannelIds } from "../../config/ChannelIds";
import { Bot } from "../../interfaces/Bot";
import { Event } from "../../interfaces/Event";
import { getAuthorString } from "../../utils/bookUtils";
import { getUnixTimestamp } from "../../utils/eventUtils";
import { logger } from "../../utils/logHandler";

const HOME_GUILD_ID = process.env.HOME_GUILD_ID ?? "";
interface EventRequestDto {
  url: string;
  createEventDto: CreateEventDto;
}

async function getEventRequestEmbed(data: EventDocument, bot: Bot) {
  const homeGuild = await bot.guilds.fetch(HOME_GUILD_ID);
  const embed = new EmbedBuilder()
    .setTitle(`${data.book.title} - ${getAuthorString(data.book.authors)}`)
    .setURL(data.book.url)
    .setFooter({ text: `Event Request: ${data._id}` })
    .setColor(Colors.DarkGold)
    .setAuthor({
      name: data.type,
      iconURL: homeGuild.iconURL() ?? undefined,
    });
  if (data.book.coverUrl) {
    embed.setThumbnail(data.book.coverUrl);
  }
  if (data.description) {
    embed.addFields({
      name: "Request Reason",
      value: data.description,
      inline: false,
    });
  }
  embed.addFields({
    name: "Start Date",
    value: `<t:${getUnixTimestamp(data.dates.startDate)}:D>`,
    inline: true,
  });
  embed.addFields({
    name: "End Date",
    value: `<t:${getUnixTimestamp(data.dates.endDate)}:D>`,
    inline: true,
  });
  embed.addFields({
    name: "Requested By",
    value: `${userMention(data.requestedBy.user.userId)}`,
    inline: false,
  });
  return embed;
}

export const eventRequest: Event = {
  name: "eventRequest",
  run: async (bot: Bot, eventRequestDto: EventRequestDto) => {
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
        await (channel as TextChannel).send({ embeds: [embed] });
      }
      // TODO: send DM to event leader with guidelines
    } catch (err) {
      logger.error(`Error while handling eventRequest event ${err}`);
    }
  },
};
