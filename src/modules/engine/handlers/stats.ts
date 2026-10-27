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
} from "discord.js";

import { EngineInstallationClient } from "../client";
import { discordIdOf, engineTypeEmoji, formatEngineUser } from "../mappings";
import {
  EngineActor,
  EngineClubOverview,
  EngineLeaderboardEntry,
  EngineMemberStats,
  EngineStatsWindowQuery,
} from "../types";

const MEDAL_BY_RANK: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function separator() {
  return new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small);
}

function text(content: string) {
  return new TextDisplayBuilder().setContent(content);
}

function windowSuffix(label: string): string {
  return label === "All time" ? "" : ` (${label})`;
}

/**
 * Fetches member stats for a Discord user: the caller's own stats via the
 * actor, or another member's via the identity lookup (contract A6). Returns
 * null when the user isn't a club member.
 *
 * @param client The installation client.
 * @param query The window query.
 * @param actor The calling actor.
 * @param targetDiscordId The Discord user to show.
 * @returns The stats, or null.
 */
export async function fetchMemberStats(
  client: EngineInstallationClient,
  query: EngineStatsWindowQuery,
  actor: EngineActor,
  targetDiscordId: string,
): Promise<EngineMemberStats | null> {
  if (targetDiscordId === actor.subject) {
    return await client.getMyStats(query, actor);
  }
  const member = await client.findMemberByDiscordId(targetDiscordId);
  if (!member) return null;
  return await client.getMemberStats(member.user.id, query);
}

/**
 * Renders member stats as a Components V2 container.
 *
 * @param stats The member stats.
 * @returns The container.
 */
export function buildEngineMemberStatsContainer(
  stats: EngineMemberStats,
): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(Colors.Blurple);
  const header = [
    `# Event Stats${windowSuffix(stats.window.label)}`,
    formatEngineUser(stats.user),
    `**${stats.points}** pts · Rank ${stats.rank ? `#${stats.rank}` : "—"}`,
  ];
  container.addTextDisplayComponents(text(header.join("\n")));
  container.addSeparatorComponents(separator());
  const lines = [
    `📚 Events completed: **${stats.eventsCompleted}**`,
    `🧭 Events led: **${stats.eventsLed}**`,
    `📄 Pages read: **${stats.pagesRead}**`,
  ];
  if (stats.byType.length > 0) {
    lines.push(
      "",
      "**By type**",
      ...stats.byType.map(
        (row) =>
          `${engineTypeEmoji(row.type.key)} ${row.type.name}: ${row.events} events · ${row.points} pts`,
      ),
    );
  }
  if (stats.topAuthors.length > 0) {
    lines.push(
      "",
      `**Top authors:** ${stats.topAuthors.map((a) => `${a.name} (${a.count})`).join(", ")}`,
    );
  }
  const tiers = stats.tiers.current.map((tier) => tier.name).join(", ");
  if (tiers) lines.push("", `**Tiers:** ${tiers}`);
  if (stats.tiers.next) {
    lines.push(
      `Next: **${stats.tiers.next.tier.name}** in ${stats.tiers.next.pointsToNext} pts`,
    );
  }
  container.addTextDisplayComponents(text(lines.join("\n")));
  return container;
}

/**
 * Renders the club overview as a Components V2 container.
 *
 * @param overview The club overview.
 * @param guildName The guild name.
 * @returns The container.
 */
export function buildEngineOverviewContainer(
  overview: EngineClubOverview,
  guildName: string,
): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(Colors.DarkGold);
  container.addTextDisplayComponents(
    text(`# ${guildName} Stats${windowSuffix(overview.window.label)}`),
  );
  container.addSeparatorComponents(separator());
  const lines = [
    `🏁 Events completed: **${overview.eventsCompleted}**`,
    `👥 Active readers: **${overview.activeMembers}**`,
    `⭐ Points awarded: **${overview.totalPoints}**`,
    `📄 Pages read: **${overview.pagesRead}**`,
    `📨 ${overview.counts.requested} requested · ✅ ${overview.counts.approved} approved · 📢 ${overview.counts.announced} announced · 🟢 ${overview.counts.ongoing} ongoing`,
  ];
  if (overview.byType.length > 0) {
    lines.push(
      "",
      "**By type**",
      ...overview.byType.map(
        (row) =>
          `${engineTypeEmoji(row.type.key)} ${row.type.name}: ${row.events} events · ${row.points} pts`,
      ),
    );
  }
  if (overview.topReaders.length > 0) {
    lines.push(
      "",
      "**Top readers**",
      ...overview.topReaders.map(
        (entry, i) =>
          `${MEDAL_BY_RANK[entry.rank ?? i + 1] ?? `#${entry.rank}`} ${formatEngineUser(entry.user)} — ${entry.points} pts`,
      ),
    );
  }
  if (overview.topLeaders.length > 0) {
    lines.push(
      "",
      `**Top leaders:** ${overview.topLeaders.map((l) => `${formatEngineUser(l.user)} (${l.eventsLed})`).join(", ")}`,
    );
  }
  if (overview.topBooks.length > 0) {
    lines.push(
      `**Top books:** ${overview.topBooks.map((b) => `${b.book.title} (${b.readers})`).join(", ")}`,
    );
  }
  if (overview.topAuthors.length > 0) {
    lines.push(
      `**Top authors:** ${overview.topAuthors.map((a) => `${a.name} (${a.count})`).join(", ")}`,
    );
  }
  container.addTextDisplayComponents(text(lines.join("\n").slice(0, 3900)));
  return container;
}

/**
 * Renders one page of the engine leaderboard, in the same layout as the OWS
 * readerboard.
 *
 * @param title The title.
 * @param data The entries on this page.
 * @param interaction The interaction.
 * @param pageInfo The page position.
 * @param pageInfo.current The current page.
 * @param pageInfo.total The page count.
 * @param extras The viewer's row and the ranked total.
 * @param extras.me The viewer's leaderboard row.
 * @param extras.total The number of ranked members.
 * @returns The container.
 */
export function buildEngineLeaderboardContainer(
  title: string,
  data: EngineLeaderboardEntry[],
  interaction: ChatInputCommandInteraction,
  pageInfo: { current: number; total: number },
  extras: { me: EngineLeaderboardEntry | null; total: number },
): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(Colors.DarkGold);
  const header = [`# ${title}`];
  if (extras.me?.rank) {
    const percentile = Math.max(
      1,
      Math.ceil((extras.me.rank / Math.max(extras.total, 1)) * 100),
    );
    header.push(
      `**You are #${extras.me.rank}** · **${extras.me.points}** pts · Top ${percentile}%`,
    );
  }
  container.addTextDisplayComponents(text(header.join("\n")));
  container.addSeparatorComponents(separator());
  for (const entry of data) {
    const rank = entry.rank ?? 0;
    const medal = MEDAL_BY_RANK[rank] ?? `\`#${rank}\``;
    const tiers = entry.tiers.length
      ? ` · ${entry.tiers.map((t) => t.name).join(", ")}`
      : "";
    const line = `${medal} ${formatEngineUser(entry.user)} — **${entry.points}** pts${tiers}`;
    const discordId = discordIdOf(entry.user);
    if (discordId) {
      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(text(line))
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`usr-stats-${discordId}`)
              .setLabel("Stats")
              .setEmoji({ name: "📊" })
              .setStyle(ButtonStyle.Secondary),
          ),
      );
    } else {
      container.addTextDisplayComponents(text(line));
    }
  }
  const guildName = interaction.guild?.name ?? "";
  const footer = [
    guildName,
    `Page ${pageInfo.current} of ${pageInfo.total} · ${extras.total} readers`,
  ].filter((part) => part.length > 0);
  container
    .addSeparatorComponents(separator())
    .addTextDisplayComponents(text(`-# ${footer.join(" · ")}`));
  return container;
}
