import {
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  userMention,
} from "discord.js";

import { Bot } from "../interfaces/Bot";
import { EventDto } from "../providers/ows/dto/event.dto";
import { Participant } from "../providers/ows/dto/participant.dto";

import { getAuthorString } from "./bookUtils";

function getEventItemField(event: EventDto) {
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
export const getUnixTimestamp = (date: Date): string => {
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
      if (
        typeof participant !== "string" &&
        typeof participant.user !== "string"
      ) {
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
 * @param {EventDto[]} data Array of events.
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction instance.
 * @returns {EmbedBuilder} The embed.
 */
export function getEventsListEmbed(
  data: EventDto[],
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) {
  const embed = new EmbedBuilder()
    .setTitle("Events")
    .setFooter({ text: `Fetched by ${bot.user?.username}` })
    .setColor(Colors.Red);
  if (interaction.inGuild()) {
    embed.setAuthor({
      name: interaction.guild?.name ?? "Unknown Guild",
      iconURL: interaction.guild?.iconURL() ?? undefined,
    });
  }
  data.forEach((event: EventDto) => {
    embed.addFields(getEventItemField(event));
  });
  return embed;
}
