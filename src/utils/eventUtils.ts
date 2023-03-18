import { EventDocument, Participant } from "@orgbookclub/ows-client";
import {
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  userMention,
} from "discord.js";

import { Bot } from "../interfaces/Bot";

import { getAuthorString } from "./bookUtils";

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

/**
 * Converts a javascript date object into unix timestamp.
 *
 * @param {Date} date A JS date object.
 * @returns {string} Unix timestamp.
 */
export const getUnixTimestamp = (date: Date | string): string => {
  return Math.floor(new Date(date).getTime() / 1000).toString();
};

/**
 * Converts a particpant array to a comma separated user mention string.
 *
 * @param {Participant[]| string[]} participants Particpant list.
 * @param {boolean} includePoints Indicates whether to include particpant points in the string.
 * @param {number} limit The max number of users to show in the string.
 * @returns {string} Result string.
 */
export const getUserMentionString = (
  participants: Participant[] | string[],
  includePoints = false,
  limit = 25,
): string => {
  const limitedParticipants = participants.slice(0, limit);
  let result = limitedParticipants
    .map((participant) => {
      if (typeof participant !== "string") {
        if (includePoints) {
          return `${userMention(participant.user.userId.toString())}(${
            participant.points
          })`;
        }
        return userMention(participant.user.userId.toString());
      } else if (typeof participant === "string") {
        return userMention(participant);
      }
      return null;
    })
    .join(",");
  if (participants.length > limit) result += "...";
  return result;
};

/**
 * Creates an embed to display a list of events.
 *
 * @param {string} title The title to display in the embed.
 * @param {EventDocument[]} data Array of events.
 * @param {ChatInputCommandInteraction} interaction The interaction instance.
 * @returns {EmbedBuilder} The embed.
 */
export function getEventsListEmbed(
  title: string,
  data: EventDocument[],
  interaction: ChatInputCommandInteraction,
) {
  const embed = new EmbedBuilder().setTitle(title).setColor(Colors.Red);
  if (interaction.inGuild()) {
    embed.setAuthor({
      name: interaction.guild?.name ?? "Unknown Guild",
      iconURL: interaction.guild?.iconURL() ?? undefined,
    });
  }
  data.forEach((event: EventDocument) => {
    embed.addFields(getEventItemField(event));
  });
  return embed;
}

/**
 * Creates an embed to display details of an event.
 *
 * @param {EventDocument} data The event.
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction instance.
 * @returns {EmbedBuilder} The embed.
 */
export function getEventInfoEmbed(
  data: EventDocument,
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) {
  const embed = new EmbedBuilder()
    .setTitle(`${data.book.title} - ${getAuthorString(data.book.authors)}`)
    .setURL(data.book.url)
    .setFooter({ text: `Event ${data._id} fetched by ${bot.user?.username}` })
    .setColor(Colors.Gold)
    .setAuthor({
      name: data.type,
      iconURL: interaction.guild?.iconURL() ?? undefined,
    });
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
  if (data.threads !== null && data.threads.length > 0) {
    embed.addFields({
      name: "Thread",
      value: `<#${data.threads[0]}>`,
      inline: true,
    });
  }
  embed.addFields({
    name: "Requested By",
    value: `${userMention(data.requestedBy.user.userId)}`,
    inline: false,
  });
  if (data.leaders !== null && data.leaders.length > 0) {
    embed.addFields({
      name: "Leader(s)",
      value: getUserMentionString(data.leaders, true),
      inline: true,
    });
  }
  if (data.interested !== null && data.interested.length > 0) {
    embed.addFields({
      name: "Interested",
      value: getUserMentionString(data.interested, false),
      inline: false,
    });
  }
  if (data.readers !== null && data.readers.length > 0) {
    embed.addFields({
      name: "Reader(s)",
      value: getUserMentionString(data.readers, true),
      inline: false,
    });
  }
  return embed;
}
