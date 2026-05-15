import {
  EventDocument,
  EventsV2ControllerFindStatusEnum,
} from "@organizedbookclub/ows-client";
import {
  ChatInputCommandInteraction,
  Colors,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
  userMention,
} from "discord.js";

import { errors } from "../../../config/constants";
import { isGenreTag } from "../../../config/NonGenreTags";
import { CommandHandler } from "../../../models";
import {
  DateWindow,
  formatWindowTitle,
  resolveDateWindow,
  toEventEndDateFilter,
} from "../../../utils/dateWindow";
import { errorHandler } from "../../../utils/errorHandler";
import { SERVER_STATS_FIELDS, findAllEvents } from "../../../utils/eventsApi";
import { EVENT_TYPE_EMOJI } from "../../../utils/eventUtils";

const TOP_N = 3;
const MIN_REPEAT_COUNT = 2;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const PARTICIPANT_MEDAL: Record<number, string> = {
  0: "🥇",
  1: "🥈",
  2: "🥉",
};

type ServerStats = {
  totalCompleted: number;
  countsByType: Map<string, number>;
  topBooks: Array<{ title: string; url: string; count: number }>;
  topAuthors: Array<{ name: string; url?: string; count: number }>;
  topGenres: Array<{ name: string; count: number }>;
  topReaders: Array<{ discordId: string; count: number }>;
  topLeaders: Array<{ discordId: string; count: number }>;
  mostActiveMonth: { label: string; count: number } | null;
};

/**
 * Gets guild-wide event stats for the configured window.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleServerStats: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();

    const resolved = resolveDateWindow(interaction);
    if (!resolved.ok) {
      await interaction.editReply(resolved.error);
      return;
    }
    const window = resolved.window;

    const eventDocs = await findAllEvents(
      bot,
      {
        status: EventsV2ControllerFindStatusEnum.Completed,
        ...toEventEndDateFilter(window),
      },
      SERVER_STATS_FIELDS,
    );

    if (eventDocs.length === 0) {
      await interaction.editReply(
        `No completed events found in ${window.label}`,
      );
      return;
    }

    const stats = calculateServerStats(eventDocs);
    const container = buildServerStatsContainer(stats, window, interaction);
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [container],
    });
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > events > serverstats",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

function calculateServerStats(eventDocs: EventDocument[]): ServerStats {
  const countsByType = new Map<string, number>();
  const bookCounts = new Map<
    string,
    { title: string; url: string; count: number }
  >();
  const authorCounts = new Map<string, { url?: string; count: number }>();
  const genreCounts = new Map<string, { display: string; count: number }>();
  const readerCounts = new Map<string, number>();
  const leaderCounts = new Map<string, number>();
  const monthCounts = new Map<string, { label: string; count: number }>();

  for (const event of eventDocs) {
    countsByType.set(event.type, (countsByType.get(event.type) ?? 0) + 1);

    const book = event.book;
    if (book) {
      if (book._id) {
        const existing = bookCounts.get(book._id);
        if (existing) {
          existing.count += 1;
        } else {
          bookCounts.set(book._id, {
            title: book.title,
            url: book.url,
            count: 1,
          });
        }
      }
      const primary = book.authors?.[0];
      if (primary?.name) {
        const existing = authorCounts.get(primary.name);
        if (existing) existing.count += 1;
        else authorCounts.set(primary.name, { url: primary.url, count: 1 });
      }
      for (const tag of book.genres ?? []) {
        if (!isGenreTag(tag)) continue;
        const display = tag.trim();
        const key = display.toLowerCase();
        const existing = genreCounts.get(key);
        if (existing) existing.count += 1;
        else genreCounts.set(key, { display, count: 1 });
      }
    }

    const readerIds = new Set<string>();
    for (const r of event.readers) {
      if (r.user?.userId) readerIds.add(r.user.userId);
    }
    for (const id of readerIds) {
      readerCounts.set(id, (readerCounts.get(id) ?? 0) + 1);
    }

    if (event.type === "BuddyRead") {
      const leaderIds = new Set<string>();
      for (const l of event.leaders) {
        if (l.user?.userId) leaderIds.add(l.user.userId);
      }
      for (const id of leaderIds) {
        leaderCounts.set(id, (leaderCounts.get(id) ?? 0) + 1);
      }
    }

    const endDateRaw = event.dates?.endDate;
    if (endDateRaw) {
      const d = new Date(endDateRaw);
      if (!Number.isNaN(d.getTime())) {
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        const label = `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
        const existing = monthCounts.get(key);
        if (existing) existing.count += 1;
        else monthCounts.set(key, { label, count: 1 });
      }
    }
  }

  const topBooks = [...bookCounts.values()]
    .filter((b) => b.count >= MIN_REPEAT_COUNT)
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    .slice(0, TOP_N);

  const topAuthors = [...authorCounts.entries()]
    .map(([name, v]) => ({ name, url: v.url, count: v.count }))
    .filter((a) => a.count >= MIN_REPEAT_COUNT)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, TOP_N);

  const topGenres = [...genreCounts.values()]
    .map((v) => ({ name: v.display, count: v.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, TOP_N);

  const topReaders = [...readerCounts.entries()]
    .map(([discordId, count]) => ({ discordId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N);

  const topLeaders = [...leaderCounts.entries()]
    .map(([discordId, count]) => ({ discordId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N);

  let mostActiveMonth: ServerStats["mostActiveMonth"] = null;
  if (monthCounts.size > 1) {
    for (const v of monthCounts.values()) {
      if (!mostActiveMonth || v.count > mostActiveMonth.count) {
        mostActiveMonth = { label: v.label, count: v.count };
      }
    }
  }

  return {
    totalCompleted: eventDocs.length,
    countsByType,
    topBooks,
    topAuthors,
    topGenres,
    topReaders,
    topLeaders,
    mostActiveMonth,
  };
}

function buildServerStatsContainer(
  stats: ServerStats,
  window: DateWindow,
  interaction: ChatInputCommandInteraction,
): ContainerBuilder {
  const guildName = interaction.guild?.name ?? "Server";
  const guildIconUrl = interaction.guild?.iconURL() ?? null;
  const title = formatWindowTitle("Server Stats", window);

  const container = new ContainerBuilder().setAccentColor(Colors.DarkGold);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# ${title}`),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small),
  );

  const summaryLines = [
    `## 📚 ${stats.totalCompleted} events completed`,
    ...renderActivityLines(stats),
  ];
  const summaryContent = summaryLines.join("\n");
  if (guildIconUrl) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(summaryContent),
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(guildIconUrl)),
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(summaryContent),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small),
  );

  const topLines = renderTopLines(stats);
  if (topLines.length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(topLines.join("\n")),
    );
  }

  if (stats.topReaders.length > 0 || stats.topLeaders.length > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    );
  }

  if (stats.topReaders.length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        renderTopUserLines(
          "### 👥 Top readers",
          stats.topReaders,
          "events",
        ).join("\n"),
      ),
    );
  }
  if (stats.topLeaders.length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        renderTopUserLines(
          "### 🎙️ Top BR leaders",
          stats.topLeaders,
          "BRs",
        ).join("\n"),
      ),
    );
  }

  container
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# ${guildName}`),
    );

  return container;
}

function renderActivityLines(stats: ServerStats): string[] {
  const lines: string[] = [];
  for (const [type, count] of stats.countsByType.entries()) {
    const emoji = EVENT_TYPE_EMOJI[type] ?? "";
    const heading = emoji ? `${emoji} **${type}**` : `**${type}**`;
    lines.push(`> ${heading}: ${count}`);
  }
  if (stats.mostActiveMonth) {
    lines.push("");
    lines.push(
      `> 📅 Most active month: **${stats.mostActiveMonth.label}** (${stats.mostActiveMonth.count} events)`,
    );
  }
  return lines;
}

function renderTopLines(stats: ServerStats): string[] {
  const sections: string[] = [];

  if (stats.topBooks.length > 0) {
    sections.push("### 📚 Top books");
    stats.topBooks.forEach((b, i) => {
      sections.push(
        `> ${i + 1}. [${b.title}](${b.url}) — ${b.count}× event(s)`,
      );
    });
  }

  if (stats.topAuthors.length > 0) {
    sections.push("### 🪶 Top authors");
    stats.topAuthors.forEach((a, i) => {
      const linked = a.url ? `[${a.name}](${a.url})` : a.name;
      sections.push(`> ${i + 1}. ${linked} — ${a.count} book(s)`);
    });
  }

  if (stats.topGenres.length > 0) {
    sections.push("### 🔖 Top genres");
    stats.topGenres.forEach((g, i) => {
      sections.push(`> ${i + 1}. ${g.name} — ${g.count}`);
    });
  }

  return sections;
}

function renderTopUserLines(
  heading: string,
  users: Array<{ discordId: string; count: number }>,
  unit: string,
): string[] {
  const lines = [heading];
  users.forEach((u, i) => {
    const medal = PARTICIPANT_MEDAL[i] ?? `\`#${i + 1}\``;
    lines.push(`> ${medal} ${userMention(u.discordId)} — ${u.count} ${unit}`);
  });
  return lines;
}

export { handleServerStats };
