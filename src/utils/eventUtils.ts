import {
  BookDocument,
  EventDocument,
  EventDtoStatusEnum,
} from "@organizedbookclub/ows-client";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  Colors,
  ContainerBuilder,
  EmbedBuilder,
  ModalSubmitInteraction,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
  TimestampStyles,
  channelMention,
  time,
  userMention,
} from "discord.js";

import { labels } from "../config/constants";
import { Bot } from "../models";

import { getAuthorString } from "./bookUtils";
import { logToWebhook } from "./logHandler";
import { deleteBRRequest } from "./messageUtils";
import { customSubstring } from "./stringUtils";
import { getUserMentionString } from "./userUtils";

const EVENT_TYPE_EMOJI: Record<string, string> = {
  BuddyRead: "👥",
  MonthlyRead: "🗓️",
  ShortStoryRead: "📖",
  PoetryRead: "🪶",
  Other: "📚",
};

const EVENT_STATUS_EMOJI: Record<string, string> = {
  Requested: "📨",
  Approved: "✅",
  Announced: "📢",
  Ongoing: "🟢",
  Completed: "🏁",
  Rejected: "❌",
  Cancelled: "🚫",
};

const EDIT_BUTTON = (eventId: string) =>
  new ButtonBuilder()
    .setCustomId(`evt-edit-${eventId}`)
    .setLabel(labels.Edit)
    .setEmoji({ name: "✏️" })
    .setStyle(ButtonStyle.Secondary);

/**
 * Builds the state-aware list of staff action buttons for an event card.
 * Empty array if the status has no staff actions beyond Edit (which is always
 * appended last).
 *
 * @param event The event document.
 * @returns Array of buttons for the action row.
 */
function buildStaffActionButtons(event: EventDocument): ButtonBuilder[] {
  const buttons: ButtonBuilder[] = [];
  const id = event._id;

  if (event.status === EventDtoStatusEnum.Requested) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`evt-approve-${id}`)
        .setLabel(labels.Approve)
        .setEmoji({ name: "✅" })
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`evt-reject-${id}`)
        .setLabel(labels.Reject)
        .setEmoji({ name: "❌" })
        .setStyle(ButtonStyle.Danger),
    );
  } else if (event.status === EventDtoStatusEnum.Approved) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`evt-thread-${id}`)
        .setLabel(labels.CreateThread)
        .setEmoji({ name: "🧵" })
        .setStyle(ButtonStyle.Primary),
    );
    if (event.threads && event.threads.length > 0) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`evt-announce-${id}`)
          .setLabel(labels.Announce)
          .setEmoji({ name: "📢" })
          .setStyle(ButtonStyle.Primary),
      );
    }
  } else if (event.status === EventDtoStatusEnum.Completed) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`evt-addpts-${id}`)
        .setLabel(labels.AddPoints)
        .setEmoji({ name: "➕" })
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`evt-rmpts-${id}`)
        .setLabel(labels.RemovePoints)
        .setEmoji({ name: "➖" })
        .setStyle(ButtonStyle.Danger),
    );
  }

  buttons.push(EDIT_BUTTON(id));
  return buttons;
}

/**
 * Creates a Components V2 Container to display a list of events. Each event
 * renders as its own Section with the cover as a thumbnail accessory.
 *
 * Pass `showTypeAndStatus` when the list mixes event types/statuses (e.g.
 * `/events search`); omit it when the list is already filtered to a single
 * type+status (e.g. `/events list`, `/user events`) so those fields don't
 * repeat on every row.
 *
 * @param title The page heading (rendered as `# {title}`).
 * @param eventList Array of events.
 * @param interaction The interaction instance.
 * @param showTypeAndStatus Whether to show per-row type & status lines.
 * @param subtitle Optional small grey subtitle under the heading.
 * @param pageInfo Optional `{ current, total }` to render as part of the footer.
 * @returns The container.
 */
export function getEventsListContainer(
  title: string,
  eventList: EventDocument[],
  interaction: ChatInputCommandInteraction,
  showTypeAndStatus = false,
  subtitle?: string,
  pageInfo?: { current: number; total: number },
) {
  const container = new ContainerBuilder().setAccentColor(Colors.Red);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# ${title}`),
  );
  if (subtitle) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${subtitle}`),
    );
  }
  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small),
  );

  eventList.forEach((event) => {
    const start =
      event.dates.startDate !== undefined
        ? `__Start__: ${time(
            new Date(event.dates.startDate),
            TimestampStyles.LongDate,
          )}`
        : "";
    const end =
      event.dates.endDate !== undefined
        ? `__End__: ${time(
            new Date(event.dates.endDate),
            TimestampStyles.LongDate,
          )}`
        : "";
    const datesLine = start && end ? `${start} • ${end}` : start || end || "";

    const authorString = getAuthorString(event.book.authors);
    const typeIcon = EVENT_TYPE_EMOJI[event.type] ?? "";
    const statusIcon = EVENT_STATUS_EMOJI[event.status] ?? "";

    const lines: string[] = [`### [${event.book.title}](${event.book.url})`];
    lines.push(`-# by ${authorString}`);
    if (showTypeAndStatus) {
      lines.push(
        `> ${typeIcon} ${event.type}  •  ${statusIcon} ${event.status}`,
      );
    }
    if (datesLine) lines.push(`> ${datesLine}`);
    lines.push(`> ID: \`${event._id}\``);

    const section = new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join("\n")),
    );

    if (event.book.coverUrl) {
      section.setThumbnailAccessory(
        new ThumbnailBuilder().setURL(event.book.coverUrl),
      );
    }

    container.addSectionComponents(section);

    const buttons: ButtonBuilder[] = [
      new ButtonBuilder()
        .setCustomId(`evt-info-${event._id}`)
        .setLabel("Details")
        .setEmoji({ name: "ℹ️" })
        .setStyle(ButtonStyle.Secondary),
    ];
    const joinable: string[] = [
      EventDtoStatusEnum.Approved,
      EventDtoStatusEnum.Announced,
      EventDtoStatusEnum.Ongoing,
    ];
    if (event.type === "BuddyRead" && joinable.includes(event.status)) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`evt-join-${event._id}`)
          .setLabel("Join")
          .setEmoji({ name: "✅" })
          .setStyle(ButtonStyle.Success),
      );
    }
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(buttons),
    );
  });

  const guildName = interaction.inGuild()
    ? (interaction.guild?.name ?? "Unknown Guild")
    : "";
  const pageStr = pageInfo
    ? `Page ${pageInfo.current} of ${pageInfo.total}`
    : "";
  const footerParts = [guildName, pageStr].filter((s) => s.length > 0);
  if (footerParts.length > 0) {
    container
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Small),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# ${footerParts.join(" · ")}`),
      );
  }

  return container;
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
  if (event.requestedBy?.user?.userId) {
    embed.addFields({
      name: "Requested By",
      value: `${userMention(event.requestedBy.user.userId)}`,
      inline: false,
    });
  }
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
 * Returns an ActionRow with state-aware staff action buttons for an event,
 * or null if there are no buttons to render. Caller decides whether to
 * include it (typically based on whether the viewer has the staff role).
 *
 * @param event The event document.
 * @returns An ActionRow with buttons, or null.
 */
export function getEventInfoStaffActionRow(event: EventDocument) {
  const buttons = buildStaffActionButtons(event);
  if (buttons.length === 0) return null;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
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
      const userId = participant.user?.userId;
      if (!userId) continue;
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
