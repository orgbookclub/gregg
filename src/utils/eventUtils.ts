import {
  EventDocument,
  Participant,
  ParticipantDto,
} from "@orgbookclub/ows-client";
import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  ModalSubmitInteraction,
  TimestampStyles,
  channelMention,
  time,
  userMention,
} from "discord.js";

import { getAuthorString } from "./bookUtils";

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
          ? `\n> __Start__: ${time(
              new Date(event.dates.startDate),
              TimestampStyles.LongDate,
            )}`
          : "") +
        (event.dates.endDate !== undefined
          ? ` | __End__: ${time(
              new Date(event.dates.endDate),
              TimestampStyles.LongDate,
            )}`
          : ""),
      inline: false,
    };
  }
}

/**
 * Creates an embed to display details of an event.
 *
 * @param event The event.
 * @param interaction The interaction instance.
 * @returns The embed.
 */
export function getEventInfoEmbed(
  event: EventDocument,
  interaction: ChatInputCommandInteraction | ButtonInteraction,
) {
  const embed = new EmbedBuilder()
    .setTitle(`${event.book.title} - ${getAuthorString(event.book.authors)}`)
    .setURL(event.book.url)
    .setFooter({ text: `Event ID: ${event._id}` })
    .setColor(Colors.Gold)
    .setAuthor({
      name: `${event.status} ${event.type}`,
      iconURL: interaction.guild?.iconURL() ?? undefined,
    });
  if (event.book.coverUrl) {
    embed.setThumbnail(event.book.coverUrl);
  }
  if (event.description) {
    embed.addFields({
      name: "Description",
      value: event.description,
      inline: false,
    });
  }
  embed.addFields({
    name: "Start Date",
    value: `${time(new Date(event.dates.startDate), TimestampStyles.LongDate)}`,
    inline: true,
  });
  embed.addFields({
    name: "End Date",
    value: `${time(new Date(event.dates.endDate), TimestampStyles.LongDate)}`,
    inline: true,
  });
  if (event.threads && event.threads.length > 0) {
    embed.addFields({
      name: "Thread",
      value: `${event.threads.map((x) => channelMention(x)).join(", ")}`,
      inline: true,
    });
  }
  embed.addFields({
    name: "Requested By",
    value: `${userMention(event.requestedBy.user.userId)}`,
    inline: false,
  });
  if (event.leaders && event.leaders.length > 0) {
    embed.addFields({
      name: "Leader(s)",
      value: getUserMentionString(event.leaders, true),
      inline: true,
    });
  }
  if (event.interested && event.interested.length > 0) {
    embed.addFields({
      name: `Interested (${event.interested.length})`,
      value: getUserMentionString(event.interested, false),
      inline: false,
    });
  }
  if (event.readers && event.readers.length > 0) {
    embed.addFields({
      name: `Reader(s) (${event.readers.length})`,
      value: getUserMentionString(event.readers, true),
      inline: false,
    });
  }
  return embed;
}

/**
 * Creates an embed to display an event request.
 *
 * @param event The event document.
 * @param interaction The interaction.
 * @returns The embed.
 */
export function getEventRequestEmbed(
  event: EventDocument,
  interaction:
    | ChatInputCommandInteraction
    | ButtonInteraction
    | ModalSubmitInteraction,
) {
  const embed = new EmbedBuilder()
    .setTitle(`${event.book.title} - ${getAuthorString(event.book.authors)}`)
    .setURL(event.book.url)
    .setFooter({ text: `Event ID: ${event._id}` })
    .setColor(Colors.DarkGold)
    .setAuthor({
      name: `${event.type} Request`,
      iconURL: interaction.guild?.iconURL() ?? undefined,
    });
  if (event.book.coverUrl) {
    embed.setThumbnail(event.book.coverUrl);
  }
  if (event.description) {
    embed.addFields({
      name: "Request Reason",
      value: event.description,
      inline: false,
    });
  }
  embed.addFields({
    name: "Start Date",
    value: `${time(new Date(event.dates.startDate), TimestampStyles.LongDate)}`,
    inline: true,
  });
  embed.addFields({
    name: "End Date",
    value: `${time(new Date(event.dates.endDate), TimestampStyles.LongDate)}`,
    inline: true,
  });
  embed.addFields({
    name: "Requested By",
    value: `${userMention(event.requestedBy.user.userId)}`,
    inline: false,
  });
  if (event.interested && event.interested.length > 0) {
    embed.addFields({
      name: `Interested (${event.interested.length})`,
      value: getUserMentionString(event.interested, false),
      inline: false,
    });
  }
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

/**
 * Converts a participant object to its corresponding dto.
 *
 * @param participant The participant object.
 * @returns The participant dto.
 */
export function participantToDto(participant: Participant) {
  const participantDto: ParticipantDto = {
    ...participant,
    user: participant.user._id,
  };
  return participantDto;
}

/**
 * Returns the first day and the last day of the next month, considering year changes and varying month lengths.
 *
 * @param date The date.
 * @returns A tupe of dates.
 */
export function getNextMonthRange(date: Date): [Date, Date] {
  const currentMonth = date.getMonth();
  const currentYear = date.getFullYear();
  let nextMonth: number;
  let nextYear: number;

  if (currentMonth === 11) {
    // If current month is December, go to next year
    nextMonth = 0;
    nextYear = currentYear + 1;
  } else {
    // Otherwise, go to next month in the same year
    nextMonth = currentMonth + 1;
    nextYear = currentYear;
  }

  // Get the first day of the next month
  const firstDayOfNextMonth = new Date(nextYear, nextMonth, 1);

  // Move to the next month and subtract 1 day to get the last day of the next month
  const lastDayOfNextMonth = new Date(nextYear, nextMonth + 1, 0);

  return [firstDayOfNextMonth, lastDayOfNextMonth];
}
