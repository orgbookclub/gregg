import { EventsV2ControllerFindStatusEnum } from "@organizedbookclub/ows-client";
import { GuildsConfig } from "@prisma/client";
import { captureCheckIn } from "@sentry/node";
import {
  Collection,
  Colors,
  EmbedBuilder,
  Guild,
  GuildMember,
  Role,
  roleMention,
  userMention,
} from "discord.js";

import { titles } from "../config/constants";
import { Bot, Job } from "../models";
import {
  DateWindow,
  isAllTimeWindow,
  toEventEndDateFilter,
  windowFromPreset,
} from "../utils/dateWindow";
import { getAllGuildConfigs } from "../utils/dbUtils";
import { errorHandler } from "../utils/errorHandler";
import { READERBOARD_FIELDS, findAllEvents } from "../utils/eventsApi";
import {
  ReaderboardScore,
  calculateReaderboardScores,
} from "../utils/eventUtils";
import { logToWebhook } from "../utils/logHandler";
import { hasRole } from "../utils/userUtils";

type ReaderRoleConfig = GuildsConfig["readerRoles"][number];

async function getCompletedEventsForWindow(bot: Bot, window: DateWindow) {
  return await findAllEvents(
    bot,
    {
      status: EventsV2ControllerFindStatusEnum.Completed,
      ...toEventEndDateFilter(window),
    },
    READERBOARD_FIELDS,
  );
}

async function getRole(guild: Guild, roleId: string): Promise<Role | null> {
  return await guild.roles.fetch(roleId);
}

async function updateMemberRole(
  role: Role,
  requiredPoints: number,
  member: GuildMember,
  points: number,
  logWebhookUrl: string,
) {
  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle(titles.ReaderRoleUpdate)
    .setTimestamp();

  if (hasRole(member, role.id) && points < requiredPoints) {
    await member.roles.remove(role);

    embed.setDescription(
      `${roleMention(role.id)} removed from ${userMention(member.id)}`,
    );
    await logToWebhook({ embeds: [embed] }, logWebhookUrl);
  } else if (!hasRole(member, role.id) && points >= requiredPoints) {
    await member.roles.add(role);

    embed.setDescription(
      `${roleMention(role.id)} added to ${userMention(member.id)}`,
    );
    await logToWebhook({ embeds: [embed] }, logWebhookUrl);
  }
}

function buildScoreMap(scores: ReaderboardScore[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const [discordId, [, points]] of scores) {
    map.set(discordId, points);
  }
  return map;
}

async function processReaderRole(
  bot: Bot,
  guild: Guild,
  guildMembers: Collection<string, GuildMember>,
  readerRole: ReaderRoleConfig,
  logWebhookUrl: string,
  scoreMapCache: Map<string, Map<string, number>>,
) {
  const window = windowFromPreset(readerRole.window);
  const cacheKey = `${window.after?.toISOString() ?? ""}|${window.before?.toISOString() ?? ""}`;

  let scoreMap = scoreMapCache.get(cacheKey);
  if (!scoreMap) {
    const eventDocs = await getCompletedEventsForWindow(bot, window);
    if (eventDocs.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle(titles.ReaderRoleUpdate)
        .setDescription(
          `No completed events found for the configured window — skipping reader role \`${readerRole.role}\` to avoid stripping current holders based on an empty score map.`,
        )
        .setTimestamp();
      await logToWebhook({ embeds: [embed] }, logWebhookUrl);
      return;
    }
    scoreMap = buildScoreMap(calculateReaderboardScores(eventDocs));
    scoreMapCache.set(cacheKey, scoreMap);
  }

  const role = await getRole(guild, readerRole.role);
  if (!role) {
    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle(titles.ReaderRoleUpdate)
      .setDescription(
        `Reader role \`${readerRole.role}\` is configured but no longer exists in this guild — skipping. Use \`/config removereaderrole\` to clean up the entry.`,
      )
      .setTimestamp();
    await logToWebhook({ embeds: [embed] }, logWebhookUrl);
    return;
  }

  const candidateIds = new Set<string>();
  for (const [discordId] of scoreMap) {
    if (guildMembers.has(discordId)) candidateIds.add(discordId);
  }
  for (const member of guildMembers.values()) {
    if (hasRole(member, role.id)) candidateIds.add(member.id);
  }

  // For non-all-time windows (e.g. "this-year", "this-month") the role is a
  // recognition tier — "Reader of the Month/Year" — awarded to the member(s)
  // with the highest score in the window, provided they also clear the
  // configured points floor. Ties result in all tied members holding the role.
  const isTopScorerMode = !isAllTimeWindow(window);
  let winners: Set<string> | undefined;
  if (isTopScorerMode) {
    let maxPoints = -1;
    for (const discordId of candidateIds) {
      if (!guildMembers.has(discordId)) continue;
      const points = scoreMap.get(discordId) ?? 0;
      if (points >= readerRole.points && points > maxPoints) {
        maxPoints = points;
      }
    }
    winners = new Set<string>();
    if (maxPoints >= readerRole.points && maxPoints > 0) {
      for (const discordId of candidateIds) {
        if (!guildMembers.has(discordId)) continue;
        const points = scoreMap.get(discordId) ?? 0;
        if (points === maxPoints) winners.add(discordId);
      }
    }
  }

  for (const discordId of candidateIds) {
    const member = guildMembers.get(discordId);
    if (!member) continue;
    const points = scoreMap.get(discordId) ?? 0;
    if (isTopScorerMode && winners) {
      await updateMemberRoleTopScorer(
        role,
        member,
        winners.has(discordId),
        logWebhookUrl,
      );
    } else {
      await updateMemberRole(
        role,
        readerRole.points,
        member,
        points,
        logWebhookUrl,
      );
    }
  }
}

async function updateMemberRoleTopScorer(
  role: Role,
  member: GuildMember,
  shouldHold: boolean,
  logWebhookUrl: string,
) {
  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle(titles.ReaderRoleUpdate)
    .setTimestamp();

  if (hasRole(member, role.id) && !shouldHold) {
    await member.roles.remove(role);
    embed.setDescription(
      `${roleMention(role.id)} removed from ${userMention(member.id)}`,
    );
    await logToWebhook({ embeds: [embed] }, logWebhookUrl);
  } else if (!hasRole(member, role.id) && shouldHold) {
    await member.roles.add(role);
    embed.setDescription(
      `${roleMention(role.id)} added to ${userMention(member.id)}`,
    );
    await logToWebhook({ embeds: [embed] }, logWebhookUrl);
  }
}

const jobName = "updateReaderRoles";

const cronTime = "50 23 * * *";

export const updateReaderRoles: Job = {
  name: jobName,
  cronTime: cronTime,
  callBack: async (bot) => {
    const checkInId = captureCheckIn(
      {
        monitorSlug: jobName,
        status: "in_progress",
      },
      {
        schedule: {
          type: "crontab",
          value: cronTime,
        },
      },
    );

    try {
      const guilds = await getAllGuildConfigs(bot);

      for (const guildDoc of guilds) {
        if (!guildDoc.config.enableEventJobs) {
          continue;
        }
        const readerRoles = guildDoc.config.readerRoles;
        if (readerRoles.length === 0) continue;

        const guild = await bot.guilds.fetch(guildDoc.guildId);
        const guildMembers = await guild.members.fetch();
        const logWebhookUrl = guildDoc.config.logWebhookUrl;
        const scoreMapCache = new Map<string, Map<string, number>>();

        for (const readerRole of readerRoles) {
          await processReaderRole(
            bot,
            guild,
            guildMembers,
            readerRole,
            logWebhookUrl,
            scoreMapCache,
          );
        }
      }
      captureCheckIn({
        checkInId,
        monitorSlug: jobName,
        status: "ok",
      });
    } catch (error) {
      await errorHandler(bot, `jobs > ${jobName}`, error);
      captureCheckIn({
        checkInId,
        monitorSlug: jobName,
        status: "error",
      });
    }
  },
};
