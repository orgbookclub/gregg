import {
  EventDocument,
  EventDtoStatusEnum,
} from "@organizedbookclub/ows-client";
import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Colors,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
  User,
} from "discord.js";

import { errors } from "../../../config/constants";
import { isGenreTag } from "../../../config/NonGenreTags";
import { Bot, CommandHandler } from "../../../models";
import { Stats } from "../../../models/commands/events/Stats";
import { UserEventStats } from "../../../models/commands/events/UserEventStats";
import {
  DateWindow,
  formatWindowTitle,
  resolveDateWindow,
  toEventEndDateFilter,
} from "../../../utils/dateWindow";
import { errorHandler } from "../../../utils/errorHandler";
import { USER_STATS_FIELDS, findAllEvents } from "../../../utils/eventsApi";
import { EVENT_TYPE_EMOJI } from "../../../utils/eventUtils";

const TOP_N = 3;
const MIN_AUTHOR_COUNT = 2;

/**
 * Gets the server event stats for a user.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleStats: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();
    const user = interaction.options.getUser("user", false) ?? interaction.user;

    const resolved = resolveDateWindow(interaction);
    if (!resolved.ok) {
      await interaction.editReply(resolved.error);
      return;
    }

    const result = await buildUserEventStatsContainer(
      bot,
      user,
      interaction,
      resolved.window,
    );
    if (typeof result === "string") {
      await interaction.editReply(result);
      return;
    }
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [result],
    });
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > events > stats",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

function calculateUserEventStats(
  id: string,
  eventDocs: EventDocument[],
): UserEventStats {
  const userEventStats: UserEventStats = {
    totalScore: 0,
    totalPages: 0,
    topAuthors: [],
    topGenres: [],
    stats: {},
  };

  const authorCounts = new Map<string, { url?: string; count: number }>();
  const genreCounts = new Map<string, { display: string; count: number }>();
  const pagesCountedBookIds = new Set<string>();

  for (const event of eventDocs) {
    const eventType = event.type;
    const readerPoints =
      event.readers.find((x) => x.user?._id === id)?.points ?? 0;
    const leaderPoints =
      event.leaders.find((x) => x.user?._id === id)?.points ?? 0;

    if (userEventStats.stats[eventType] === undefined) {
      userEventStats.stats[eventType] = {
        totalNumberOfEvents: 0,
        interestedInCount: 0,
        requestedCount: 0,
        leadCount: 0,
        readCount: 0,
        readerPoints: 0,
        leaderPoints: 0,
      };
    }
    userEventStats.stats[eventType].totalNumberOfEvents += 1;
    if (event.interested.find((x) => x.user?._id === id)) {
      userEventStats.stats[eventType].interestedInCount += 1;
    }
    if (event.requestedBy && event.requestedBy.user?._id === id) {
      userEventStats.stats[eventType].requestedCount += 1;
    }
    const wasReader = !!event.readers.find((x) => x.user?._id === id);
    const wasLeader = !!event.leaders.find((x) => x.user?._id === id);
    if (wasLeader) {
      userEventStats.stats[eventType].leadCount += 1;
    }
    if (wasReader) {
      userEventStats.stats[eventType].readCount += 1;
    }
    if (event.status === EventDtoStatusEnum.Completed) {
      userEventStats.stats[eventType].readerPoints += readerPoints;
      userEventStats.stats[eventType].leaderPoints += leaderPoints;
      userEventStats.totalScore += readerPoints + leaderPoints;

      if (wasReader || wasLeader) {
        accumulateBookStats(
          event,
          userEventStats,
          authorCounts,
          genreCounts,
          pagesCountedBookIds,
        );
      }
    }
  }

  userEventStats.topAuthors = rankAuthors(authorCounts, TOP_N);
  userEventStats.topGenres = rankGenres(genreCounts, TOP_N);

  return userEventStats;
}

function accumulateBookStats(
  event: EventDocument,
  stats: UserEventStats,
  authorCounts: Map<string, { url?: string; count: number }>,
  genreCounts: Map<string, { display: string; count: number }>,
  pagesCountedBookIds: Set<string>,
) {
  const book = event.book;
  if (!book) return;

  if (book.numPages && book.numPages > 0) {
    const bookId = book._id;
    if (!bookId || !pagesCountedBookIds.has(bookId)) {
      stats.totalPages += book.numPages;
      if (bookId) pagesCountedBookIds.add(bookId);
    }
  }

  const primaryAuthor = book.authors?.[0];
  if (primaryAuthor?.name) {
    const existing = authorCounts.get(primaryAuthor.name);
    if (existing) {
      existing.count += 1;
    } else {
      authorCounts.set(primaryAuthor.name, {
        url: primaryAuthor.url,
        count: 1,
      });
    }
  }

  for (const tag of book.genres ?? []) {
    if (!isGenreTag(tag)) continue;
    const display = tag.trim();
    const key = display.toLowerCase();
    const existing = genreCounts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      genreCounts.set(key, { display, count: 1 });
    }
  }
}

function rankAuthors(
  counts: Map<string, { url?: string; count: number }>,
  n: number,
): UserEventStats["topAuthors"] {
  return [...counts.entries()]
    .map(([name, v]) => ({ name, url: v.url, count: v.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, n);
}

function rankGenres(
  counts: Map<string, { display: string; count: number }>,
  n: number,
): UserEventStats["topGenres"] {
  return [...counts.entries()]
    .map(([, v]) => ({ name: v.display, count: v.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, n);
}

function getUserEventStatsContainer(
  userEventStats: UserEventStats,
  id: string,
  user: User,
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  window?: DateWindow,
): ContainerBuilder {
  const baseTitle = `${user.username} | Event Stats`;
  const title = window ? formatWindowTitle(baseTitle, window) : baseTitle;

  const container = new ContainerBuilder().setAccentColor(Colors.Gold);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# ${title}`),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small),
  );

  const summaryLine = `## 🏆 ${userEventStats.totalScore} pts\n## 📖 ${userEventStats.totalPages.toLocaleString()} pages`;
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(summaryLine),
      )
      .setThumbnailAccessory(
        new ThumbnailBuilder().setURL(
          user.displayAvatarURL() ?? user.defaultAvatarURL,
        ),
      ),
  );

  const topLines = renderTopLines(userEventStats);
  if (topLines.length > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(topLines.join("\n")),
    );
  }

  const perTypeLines = renderPerTypeLines(userEventStats.stats);
  if (perTypeLines.length > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(perTypeLines.join("\n")),
    );
  }

  const guildName = interaction.guild?.name ?? "";
  const footerParts = [guildName, `User ID: ${id}`].filter((s) => s.length > 0);
  container
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# ${footerParts.join(" · ")}`),
    );

  return container;
}

function renderTopLines(stats: UserEventStats): string[] {
  const sections: string[] = [];

  const significantAuthors = stats.topAuthors.filter(
    (a) => a.count >= MIN_AUTHOR_COUNT,
  );
  if (significantAuthors.length > 0) {
    sections.push("### Top authors");
    significantAuthors.forEach((a, i) => {
      const linked = a.url ? `[${a.name}](${a.url})` : a.name;
      sections.push(`> ${i + 1}. ${linked} — ${a.count} book(s)`);
    });
  }

  if (stats.topGenres.length > 0) {
    sections.push("### Top genres");
    stats.topGenres.forEach((g, i) => {
      sections.push(`> ${i + 1}. ${g.name} — ${g.count}`);
    });
  }

  return sections;
}

function renderPerTypeLines(stats: Record<string, Stats>): string[] {
  const lines: string[] = [];
  const types = Object.keys(stats);
  if (types.length === 0) return lines;

  lines.push("### Activity by event type");
  types.forEach((eventType, idx) => {
    const s = stats[eventType];
    const emoji = EVENT_TYPE_EMOJI[eventType] ?? "";
    const heading = emoji ? `${emoji} **${eventType}**` : `**${eventType}**`;
    if (idx > 0) lines.push("");
    lines.push(`${heading} (${s.readerPoints + s.leaderPoints} pts)`);
    lines.push(`> ${s.readerPoints} reader pts from ${s.readCount} events`);
    lines.push(`> ${s.leaderPoints} leader pts from ${s.leadCount} events`);
    lines.push(`> Was interested in ${s.interestedInCount} events`);
    lines.push(`> Requested ${s.requestedCount} events`);
  });
  return lines;
}

/**
 * Builds the user event stats container for the given Discord user, or
 * returns an error string if no user/events found. Shared by the slash
 * command and the Stats button on `/user readerboard`.
 *
 * @param bot The bot instance.
 * @param user The Discord user.
 * @param interaction The interaction (used for guild metadata in the embed).
 * @param window Optional time window to scope the stats; omit for all-time.
 * @returns The stats container, or a user-facing error message.
 */
async function buildUserEventStatsContainer(
  bot: Bot,
  user: User,
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  window?: DateWindow,
): Promise<ContainerBuilder | string> {
  const userResponse = await bot.api.users.usersControllerFindOneByUserId({
    userid: user.id,
  });
  if (!userResponse) {
    return `No user found! Please check if the user ID ${user.id} is registered with the bot`;
  }
  const userId = userResponse.data._id;
  const eventDocs = await findAllEvents(
    bot,
    {
      participantIds: [userId],
      ...(window ? toEventEndDateFilter(window) : {}),
    },
    USER_STATS_FIELDS,
  );
  if (eventDocs.length === 0) {
    return window
      ? `No events found for given user in ${window.label}`
      : "No events found for given user";
  }
  const stats = calculateUserEventStats(userId, eventDocs);
  return getUserEventStatsContainer(stats, userId, user, interaction, window);
}

export { handleStats, buildUserEventStatsContainer };
