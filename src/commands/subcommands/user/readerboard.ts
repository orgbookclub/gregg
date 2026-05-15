import {
  EventsV2ControllerFindStatusEnum,
  EventsV2ControllerFindTypeEnum,
} from "@organizedbookclub/ows-client";
import {
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Colors,
  ContainerBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  userMention,
} from "discord.js";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import {
  formatWindowTitle,
  resolveDateWindow,
  toEventEndDateFilter,
} from "../../../utils/dateWindow";
import { errorHandler } from "../../../utils/errorHandler";
import { READERBOARD_FIELDS, findAllEvents } from "../../../utils/eventsApi";
import {
  ReaderboardScore,
  calculateReaderboardScores,
} from "../../../utils/eventUtils";
import { PaginationManager } from "../../../utils/paginationManager";

const MEDAL_BY_POSITION: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

type ViewerRank = {
  position: number;
  points: number;
  percentile: number;
};

type ReaderboardExtras = {
  totalRanked: number;
  viewerRank: ViewerRank | null;
};

/**
 * Gets the server reading leaderboard.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleReaderboard: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();

    const resolved = resolveDateWindow(interaction);
    if (!resolved.ok) {
      await interaction.editReply(resolved.error);
      return;
    }
    const window = resolved.window;
    const eventType = interaction.options.getString(
      "type",
    ) as EventsV2ControllerFindTypeEnum | null;

    const eventDocs = await findAllEvents(
      bot,
      {
        status: EventsV2ControllerFindStatusEnum.Completed,
        ...(eventType ? { type: eventType } : {}),
        ...toEventEndDateFilter(window),
      },
      READERBOARD_FIELDS,
    );

    if (eventDocs.length === 0) {
      await interaction.editReply(errors.NoEventsForUserError);
      return;
    }
    const scores = calculateReaderboardScores(eventDocs);

    const viewerRank = computeViewerRank(scores, interaction.user.id);

    const baseTitle = eventType
      ? `Server Readerboard · ${eventType}`
      : "Server Readerboard";
    const title = formatWindowTitle(baseTitle, window);

    const extras: ReaderboardExtras = {
      totalRanked: scores.length,
      viewerRank,
    };

    const pageSize = 10;
    const pagedContentManager = new PaginationManager<ReaderboardScore>(
      pageSize,
      scores,
      bot,
      (t, v, ix, pi) => getReaderboardContainer(t, v, ix, pi, extras),
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
      "commands > user > readerboard",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

function computeViewerRank(
  scores: ReaderboardScore[],
  viewerDiscordId: string,
): ViewerRank | null {
  const entry = scores.find(([id]) => id === viewerDiscordId);
  if (!entry) return null;
  const [, [position, points]] = entry;
  const percentile = Math.max(1, Math.ceil((position / scores.length) * 100));
  return { position, points, percentile };
}

function getReaderboardContainer(
  title: string,
  data: ReaderboardScore[],
  interaction: ChatInputCommandInteraction,
  pageInfo: { current: number; total: number },
  extras: ReaderboardExtras,
) {
  const container = new ContainerBuilder().setAccentColor(Colors.DarkGold);

  const headerLines: string[] = [`# ${title}`];
  if (extras.viewerRank) {
    const { position, points, percentile } = extras.viewerRank;
    headerLines.push(
      `**You are #${position}** · **${points}** pts · Top ${percentile}%`,
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

  data.forEach(([discordId, [position, points]]) => {
    const medal = MEDAL_BY_POSITION[position] ?? `\`#${position}\``;
    const line = `${medal} ${userMention(discordId)} — **${points}** pts`;

    const section = new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(line))
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`usr-stats-${discordId}`)
          .setLabel("Stats")
          .setEmoji({ name: "📊" })
          .setStyle(ButtonStyle.Secondary),
      );

    container.addSectionComponents(section);
  });

  const guildName = interaction.inGuild()
    ? (interaction.guild?.name ?? "Unknown Guild")
    : "";
  const startIdx = data[0]?.[1]?.[0] ?? 1;
  const endIdx = data[data.length - 1]?.[1]?.[0] ?? extras.totalRanked;
  const pageSummary =
    extras.totalRanked === 0
      ? `Page ${pageInfo.current} of ${pageInfo.total}`
      : `Showing #${startIdx}–#${endIdx} of ${extras.totalRanked} readers`;
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

export { handleReaderboard };
