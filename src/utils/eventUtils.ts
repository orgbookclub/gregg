import { EventDocument, Participant } from "@orgbookclub/ows-client";
import {
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  channelMention,
  userMention,
} from "discord.js";

import { Bot } from "../models";

import { getAuthorString } from "./bookUtils";

const HOME_GUILD_ID = process.env.HOME_GUILD_ID ?? "";

/**
 * Converts a javascript date object into unix timestamp.
 *
 * @param date A JS date object or a string.
 * @returns The unix timestamp string.
 */
export const getUnixTimestamp = (date: Date | string) => {
  return Math.floor(new Date(date).getTime() / 1000).toString();
};

/**
 * Converts a particpant array or a user array to a comma separated user mention string.
 *
 * @param participants Participant list or a user list.
 * @param includePoints Indicates whether to include particpant points in the string.
 * @param limit The max number of users to show in the string.
 * @returns Result string.
 */
export const getUserMentionString = (
  participants: Participant[] | string[],
  includePoints = false,
  limit = 25,
) => {
  const limitedParticipants = participants.slice(0, limit);
  return limitedParticipants
    .map((participant) => {
      if (typeof participant === "string") {
        return userMention(participant);
      }
      const userId = participant.user.userId.toString();
      return includePoints
        ? `${userMention(userId)}(${participant.points})`
        : userMention(userId);
    })
    .join(",");
};

/**
 * Creates an embed to display a list of events.
 *
 * @param title The title to display in the embed.
 * @param eventList Array of events.
 * @param interaction The interaction instance.
 * @returns The embed.
 */
export function getEventsListEmbed(
  title: string,
  eventList: EventDocument[],
  interaction: ChatInputCommandInteraction,
) {
  const embed = new EmbedBuilder().setTitle(title).setColor(Colors.Red);
  if (interaction.inGuild()) {
    embed.setAuthor({
      name: interaction.guild?.name ?? "Unknown Guild",
      iconURL: interaction.guild?.iconURL() ?? undefined,
    });
  }
  eventList.forEach((event: EventDocument) => {
    embed.addFields(getEventItemField(event));
  });
  return embed;

  function getEventItemField(event: EventDocument) {
    return {
      name: `📕 ${event.book.title} - ${getAuthorString(event.book.authors)}`,
      value:
        `> [Link](${event.book.url}) | __ID__: \`${event._id}\`` +
        `\n> __Type__: ${event.type} | __Status__: ${event.status}` +
        (event.dates.startDate !== undefined
          ? `\n> __Start__: <t:${getUnixTimestamp(event.dates.startDate)}:D>`
          : "") +
        (event.dates.endDate !== undefined
          ? ` | __End__: <t:${getUnixTimestamp(event.dates.endDate)}:D>`
          : ""),
      inline: false,
    };
  }
}

/**
 * Creates an embed to display details of an event.
 *
 * @param data The event.
 * @param bot The bot instance.
 * @param interaction The interaction instance.
 * @returns The embed.
 */
export function getEventInfoEmbed(
  data: EventDocument,
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) {
  const embed = new EmbedBuilder()
    .setTitle(`${data.book.title} - ${getAuthorString(data.book.authors)}`)
    .setURL(data.book.url)
    .setFooter({ text: `Event ${data._id}` })
    .setColor(Colors.Gold)
    .setAuthor({
      name: `${data.status} ${data.type}`,
      iconURL: interaction.guild?.iconURL() ?? undefined,
    });
  if (data.book.coverUrl) {
    embed.setThumbnail(data.book.coverUrl);
  }
  if (data.description) {
    embed.addFields({
      name: "Description",
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
  if (data.threads && data.threads.length > 0) {
    embed.addFields({
      name: "Thread",
      value: `${channelMention(data.threads[0])}`,
      inline: true,
    });
  }
  embed.addFields({
    name: "Requested By",
    value: `${userMention(data.requestedBy.user.userId)}`,
    inline: false,
  });
  if (data.leaders && data.leaders.length > 0) {
    embed.addFields({
      name: "Leader(s)",
      value: getUserMentionString(data.leaders, true),
      inline: true,
    });
  }
  if (data.interested && data.interested.length > 0) {
    embed.addFields({
      name: "Interested",
      value: getUserMentionString(data.interested, false),
      inline: false,
    });
  }
  if (data.readers && data.readers.length > 0) {
    embed.addFields({
      name: "Reader(s)",
      value: getUserMentionString(data.readers, true),
      inline: false,
    });
  }
  return embed;
}

/**
 * Creates an embed to display an event request.
 *
 * @param data The event document.
 * @param bot The bot instance.
 * @returns The embed.
 */
export async function getEventRequestEmbed(data: EventDocument, bot: Bot) {
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

/**
 * Creates a title for a thread for an event.
 *
 * @param event The event.
 * @returns The title.
 */
export function getThreadTitle(event: EventDocument) {
  let eventTitle = `${event.book.title} - ${getAuthorString(
    event.book.authors,
  )}`;
  if (eventTitle.length >= 100) {
    eventTitle = eventTitle.slice(0, 96) + "...";
  }
  return eventTitle;
}
