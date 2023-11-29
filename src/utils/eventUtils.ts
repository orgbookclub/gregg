import {
  BookDocument,
  EventDocument,
  EventDtoStatusEnum,
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

import { Bot } from "../models";

import { getAuthorString } from "./bookUtils";
import { logToWebhook } from "./logHandler";
import { deleteBRRequest } from "./messageUtils";
import { customSubstring } from "./stringUtils";
import { getUserMentionString } from "./userUtils";

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
      name: `📕 ${getBookTitleWithAuthors(event.book)}`,
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
    .setTitle(getBookTitleWithAuthors(event.book))
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
      value: customSubstring(event.description, 1000),
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
      name: "Thread(s)",
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
 * Creates an embed to display details of an event announcement.
 *
 * @param event The event.
 * @param interaction The interaction instance.
 * @returns The embed.
 */
export function getEventAnnouncementEmbed(
  event: EventDocument,
  interaction: ChatInputCommandInteraction | ButtonInteraction,
) {
  const embed = new EmbedBuilder()
    .setTitle(getBookTitleWithAuthors(event.book))
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
      value: customSubstring(event.description, 1000),
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
  if (event.leaders && event.leaders.length > 0) {
    embed.addFields({
      name: "Leader(s)",
      value: getUserMentionString(event.leaders, false),
      inline: false,
    });
  }
  if (event.book.numPages) {
    embed.addFields({
      name: "Pages 📄",
      value: event.book.numPages.toString(),
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
    .setTitle(getBookTitleWithAuthors(event.book))
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
 * @param book The book document.
 * @returns The title.
 */
export function getBookTitleWithAuthors(book: BookDocument) {
  const title = `${book.title} - ${getAuthorString(book.authors)}`;
  return customSubstring(title, 100);
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

/**
 * Given a list of documents, calculates the total reader points for all the users.
 *
 * @param eventDocs List of event documents.
 * @returns An array of users, along with their position and points.
 */
export function calculateReaderboardScores(eventDocs: EventDocument[]) {
  const scoreMap = new Map<string, number>();

  for (const event of eventDocs) {
    for (const participant of event.readers.concat(event.leaders)) {
      const userId = participant.user.userId;
      scoreMap.set(
        userId,
        (scoreMap.get(userId) ?? 0) + (participant.points ?? 0),
      );
    }
  }

  const scores = [...scoreMap.entries()];
  scores.sort((a, b) => b[1] - a[1]);

  let position = 1;
  const scoresWithPosition: [string, [number, number]][] = [];
  for (const score of scores) {
    const [userId, points] = score;
    scoresWithPosition.push([userId, [position, points]]);
    position += 1;
  }

  return scoresWithPosition;
}

/**
 * Gets the embed for logging an event status update.
 *
 * @param eventDoc The old doc.
 * @param updatedEventDoc The new doc.
 * @returns An embed.
 */
export function getEventUpdateLogEmbed(
  eventDoc: EventDocument,
  updatedEventDoc: EventDocument,
) {
  const startDate = eventDoc.dates.startDate
    ? time(new Date(eventDoc.dates.startDate), TimestampStyles.RelativeTime)
    : "N/A";
  const endDate = eventDoc.dates.endDate
    ? time(new Date(eventDoc.dates.endDate), TimestampStyles.RelativeTime)
    : "N/A";
  const embed = new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle("Event Update")
    .addFields([
      {
        name: "ID",
        value: `\`${updatedEventDoc._id}\``,
      },
      {
        name: "Change",
        value: `\`${eventDoc.status}\` --> \`${updatedEventDoc.status}\``,
        inline: true,
      },
      {
        name: "Details",
        value: customSubstring(
          `${eventDoc.book.title} (${startDate} - ${endDate})`,
          1000,
        ),
      },
    ])
    .setThumbnail(eventDoc.book.coverUrl)
    .setTimestamp();
  return embed;
}

/**
 * Updates event state, logs to the webhook, and deletes the request message.
 *
 * @param bot The bot.
 * @param eventDoc The event doc.
 * @param webhookUrl The webhook url.
 * @param newState New state of the event.
 */
export async function updateEventState(
  bot: Bot,
  eventDoc: EventDocument,
  webhookUrl: string,
  newState: EventDtoStatusEnum,
) {
  const updatedEventDoc = (
    await bot.api.events.eventsControllerUpdate({
      id: eventDoc._id,
      updateEventDto: { status: newState },
    })
  ).data;

  const embed = getEventUpdateLogEmbed(eventDoc, updatedEventDoc);
  await logToWebhook({ embeds: [embed] }, webhookUrl);

  await deleteBRRequest(bot, eventDoc, webhookUrl);
}
