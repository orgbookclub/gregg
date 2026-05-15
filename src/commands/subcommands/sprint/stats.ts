import { sprints } from "@prisma/client";
import {
  Colors,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
  TimestampStyles,
  User,
  time,
} from "discord.js";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models/commands/CommandHandler";
import {
  SprintRecord,
  SprintStats,
} from "../../../models/commands/sprint/SprintStats";
import {
  DateWindow,
  formatWindowTitle,
  isAllTimeWindow,
  resolveDateWindow,
  toPrismaDateRange,
} from "../../../utils/dateWindow";
import { errorHandler } from "../../../utils/errorHandler";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Gets the total sprint status of a user.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleStats: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();

    const user = interaction.options.getUser("user") ?? interaction.user;

    const resolved = resolveDateWindow(interaction);
    if (!resolved.ok) {
      await interaction.editReply(resolved.error);
      return;
    }
    const window = resolved.window;
    const range = toPrismaDateRange(window);

    const userSprints = await bot.db.sprints.findMany({
      where: {
        participants: { some: { userId: user.id } },
        ...(range ? { endedOn: range } : {}),
      },
    });

    if (userSprints.length === 0) {
      await interaction.editReply(
        isAllTimeWindow(window)
          ? "No sprints found for given user"
          : `No sprints found for given user in ${window.label}`,
      );
      return;
    }

    const stats = calculateSprintStats(user.id, userSprints, window);
    const container = buildSprintStatsContainer(
      user,
      stats,
      window,
      interaction.guild?.name,
    );
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [container],
    });
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > sprint > stats",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

function calculateSprintStats(
  userId: string,
  sprintDocs: sprints[],
  window: DateWindow,
): SprintStats {
  const finishedSprints = sprintDocs.filter((x) =>
    x.participants.some((y) => y.userId === userId && y.didFinish),
  );

  let finishedDuration = 0;
  let pageCount = 0;
  let bestByPages: SprintRecord | null = null;
  let fastestByPpm: SprintRecord | null = null;
  const finishedDates: Date[] = [];

  for (const sprint of finishedSprints) {
    finishedDuration += sprint.duration;
    finishedDates.push(sprint.endedOn);
    const participant = sprint.participants.find(
      (x) => x.userId === userId && x.didFinish,
    );
    if (!participant) continue;
    const pages = Math.max(0, participant.endCount - participant.startCount);
    pageCount += pages;

    if (sprint.duration > 0) {
      const ppm = pages / sprint.duration;
      const record: SprintRecord = {
        pages,
        duration: sprint.duration,
        pagesPerMinute: ppm,
        endedOn: sprint.endedOn,
      };
      if (!bestByPages || pages > bestByPages.pages) bestByPages = record;
      if (!fastestByPpm || ppm > fastestByPpm.pagesPerMinute) {
        fastestByPpm = record;
      }
    }
  }

  const showCurrent = windowIncludesCurrentWeek(window);
  const { current, longest } = computeWeeklyStreak(finishedDates, showCurrent);

  return {
    participatedCount: sprintDocs.length,
    finishedCount: finishedSprints.length,
    finishedDuration,
    pageCount,
    avgSpeed:
      finishedDuration > 0 ? (pageCount / finishedDuration).toFixed(2) : "—",
    bestByPages,
    fastestByPpm,
    currentStreakWeeks: current,
    longestStreakWeeks: longest,
  };
}

function getIsoWeekStartUtc(date: Date): number {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (dayNum - 1));
  return d.getTime();
}

function windowIncludesCurrentWeek(window: DateWindow): boolean {
  const currentMonday = getIsoWeekStartUtc(new Date());
  if (window.after && currentMonday < window.after.getTime()) return false;
  if (window.before && currentMonday >= window.before.getTime()) return false;
  return true;
}

function computeWeeklyStreak(
  finishedDates: Date[],
  computeCurrent: boolean,
): { current: number; longest: number } {
  if (finishedDates.length === 0) return { current: 0, longest: 0 };

  const weeks = new Set<number>();
  for (const d of finishedDates) weeks.add(getIsoWeekStartUtc(d));
  const sorted = [...weeks].sort((a, b) => a - b);

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === WEEK_MS) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  if (!computeCurrent) return { current: 0, longest };

  let cursor = getIsoWeekStartUtc(new Date());
  if (!weeks.has(cursor)) cursor -= WEEK_MS;
  let current = 0;
  while (weeks.has(cursor)) {
    current += 1;
    cursor -= WEEK_MS;
  }

  return { current, longest };
}

function buildSprintStatsContainer(
  user: User,
  stats: SprintStats,
  window: DateWindow,
  guildName: string | undefined,
): ContainerBuilder {
  const title = formatWindowTitle(`${user.username} · Sprint Stats`, window);
  const container = new ContainerBuilder().setAccentColor(Colors.Gold);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# ${title}`),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small),
  );

  const completionPct =
    stats.participatedCount > 0
      ? Math.round((stats.finishedCount / stats.participatedCount) * 100)
      : 0;
  const summaryLine =
    `### 📕 **${stats.participatedCount}** sprints\n` +
    `### ✅ **${completionPct}%** finished (${stats.finishedCount}/${stats.participatedCount})\n` +
    `### 📖 **${stats.pageCount.toLocaleString()}** pages`;
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

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small),
  );

  const paceLines = [
    "### Pace",
    `> ⏱️ Total time: **${stats.finishedDuration}** minute(s)`,
    `> 📈 Average: **${stats.avgSpeed}** pages/min`,
  ];
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(paceLines.join("\n")),
  );

  const recordLines = renderRecordLines(stats);
  if (recordLines.length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(recordLines.join("\n")),
    );
  }

  const streakLines: string[] = ["### Streak"];
  const streakBits: string[] = [];
  if (stats.currentStreakWeeks > 0 || windowIncludesCurrentWeek(window)) {
    streakBits.push(`Current: **${stats.currentStreakWeeks}** week(s)`);
  }
  streakBits.push(`Longest: **${stats.longestStreakWeeks}** week(s)`);
  streakLines.push(`> 🔥 ${streakBits.join(" · ")}`);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(streakLines.join("\n")),
  );

  const footerParts = [guildName ?? "", `User ID: ${user.id}`].filter(
    (s) => s.length > 0,
  );
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

function renderRecordLines(stats: SprintStats): string[] {
  if (!stats.bestByPages && !stats.fastestByPpm) return [];
  const lines = ["### Records"];
  if (stats.bestByPages) {
    const r = stats.bestByPages;
    lines.push(
      `> 🏅 Best sprint: **${r.pages}** pages in ${r.duration} min on ${time(r.endedOn, TimestampStyles.ShortDate)}`,
    );
  }
  if (stats.fastestByPpm) {
    const r = stats.fastestByPpm;
    lines.push(
      `> ⚡ Fastest pace: **${r.pagesPerMinute.toFixed(2)}** pages/min on ${time(r.endedOn, TimestampStyles.ShortDate)}`,
    );
  }
  return lines;
}

export { handleStats };
