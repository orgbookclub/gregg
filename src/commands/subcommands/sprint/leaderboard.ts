import { sprints } from "@prisma/client";
import {
  ChatInputCommandInteraction,
  Colors,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  userMention,
} from "discord.js";

import { errors } from "../../../config/constants";
import { SprintMetric } from "../../../config/SprintMetricOptions";
import { CommandHandler } from "../../../models";
import {
  formatWindowTitle,
  resolveDateWindow,
  toPrismaDateRange,
} from "../../../utils/dateWindow";
import { errorHandler } from "../../../utils/errorHandler";
import { PaginationManager } from "../../../utils/paginationManager";

const METRIC_LABEL: Record<SprintMetric, string> = {
  pages: "Pages",
  minutes: "Minutes",
  completed: "Sprints completed",
};

const METRIC_UNIT: Record<SprintMetric, string> = {
  pages: "pages",
  minutes: "min",
  completed: "sprints",
};

const MEDAL_BY_POSITION: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

type SprintLeaderboardScore = [string, [number, number]];

type LeaderboardExtras = {
  totalRanked: number;
  unit: string;
  viewerRank: { position: number; value: number; percentile: number } | null;
};

/**
 * Gets the sprint leaderboard for the guild.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleLeaderboard: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();

    if (!interaction.guild) {
      await interaction.editReply(errors.SomethingWentWrongError);
      return;
    }
    const resolved = resolveDateWindow(interaction);
    if (!resolved.ok) {
      await interaction.editReply(resolved.error);
      return;
    }
    const window = resolved.window;
    const range = toPrismaDateRange(window);
    const metric =
      (interaction.options.getString("metric") as SprintMetric | null) ??
      "pages";

    const guildSprints = await bot.db.sprints.findMany({
      where: {
        guildId: interaction.guild.id,
        ...(range ? { endedOn: range } : {}),
      },
    });

    const scores = aggregateSprintScores(guildSprints, metric);
    if (scores.length === 0) {
      await interaction.editReply(
        `No finished sprints found in ${window.label}`,
      );
      return;
    }

    const viewerRank = computeViewerRank(scores, interaction.user.id);

    const baseTitle = `Sprint Leaderboard · ${METRIC_LABEL[metric]}`;
    const title = formatWindowTitle(baseTitle, window);

    const extras: LeaderboardExtras = {
      totalRanked: scores.length,
      unit: METRIC_UNIT[metric],
      viewerRank,
    };

    const pageSize = 10;
    const pagedContentManager = new PaginationManager<SprintLeaderboardScore>(
      pageSize,
      scores,
      bot,
      (t, v, ix, pi) => getLeaderboardContainer(t, v, ix, pi, extras),
      title,
    );
    const message = await interaction.editReply(
      pagedContentManager.createMessagePayloadForPage(interaction),
    );
    pagedContentManager.createCollectors(message, interaction, 5 * 60 * 1000);
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > sprint > leaderboard",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

function aggregateSprintScores(
  sprintDocs: sprints[],
  metric: SprintMetric,
): SprintLeaderboardScore[] {
  const totals = new Map<string, number>();

  for (const sprint of sprintDocs) {
    for (const participant of sprint.participants) {
      if (!participant.didFinish) continue;
      const userId = participant.userId;
      let increment = 0;
      if (metric === "pages") {
        increment = Math.max(0, participant.endCount - participant.startCount);
      } else if (metric === "minutes") {
        increment = sprint.duration;
      } else {
        increment = 1;
      }
      totals.set(userId, (totals.get(userId) ?? 0) + increment);
    }
  }

  const ordered = [...totals.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);

  let position = 1;
  const result: SprintLeaderboardScore[] = [];
  for (const [userId, value] of ordered) {
    result.push([userId, [position, value]]);
    position += 1;
  }
  return result;
}

function computeViewerRank(
  scores: SprintLeaderboardScore[],
  viewerDiscordId: string,
): { position: number; value: number; percentile: number } | null {
  const entry = scores.find(([id]) => id === viewerDiscordId);
  if (!entry) return null;
  const [, [position, value]] = entry;
  const percentile = Math.max(1, Math.ceil((position / scores.length) * 100));
  return { position, value, percentile };
}

function getLeaderboardContainer(
  title: string,
  data: SprintLeaderboardScore[],
  interaction: ChatInputCommandInteraction,
  pageInfo: { current: number; total: number },
  extras: LeaderboardExtras,
) {
  const container = new ContainerBuilder().setAccentColor(Colors.DarkGold);

  const headerLines: string[] = [`# ${title}`];
  if (extras.viewerRank) {
    const { position, value, percentile } = extras.viewerRank;
    headerLines.push(
      `**You are #${position}** · **${value.toLocaleString()}** ${extras.unit} · top ${percentile}%`,
    );
  }
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(headerLines.join("\n")),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small),
  );

  const rowLines = data.map(([discordId, [position, value]]) => {
    const medal = MEDAL_BY_POSITION[position] ?? `\`#${position}\``;
    return `${medal} ${userMention(discordId)} — **${value.toLocaleString()}** ${extras.unit}`;
  });
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(rowLines.join("\n")),
  );

  const guildName = interaction.inGuild()
    ? (interaction.guild?.name ?? "Unknown Guild")
    : "";
  const startIdx = data[0]?.[1]?.[0] ?? 1;
  const endIdx = data[data.length - 1]?.[1]?.[0] ?? extras.totalRanked;
  const pageSummary =
    extras.totalRanked === 0
      ? `Page ${pageInfo.current} of ${pageInfo.total}`
      : `Showing #${startIdx}–#${endIdx} of ${extras.totalRanked} sprinters`;
  const footerParts = [guildName, pageSummary].filter((s) => s.length > 0);
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

export { handleLeaderboard };
