import { EventDtoStatusEnum } from "@orgbookclub/ows-client";
import { GuildsConfig } from "@prisma/client";
import {
  Colors,
  EmbedBuilder,
  Guild,
  GuildMember,
  Role,
  roleMention,
  userMention,
} from "discord.js";

import { Job } from "../models";
import { OWSClient } from "../providers/owsClient";
import { getAllGuildConfigs } from "../utils/dbUtils";
import { errorHandler } from "../utils/errorHandler";
import { calculateReaderboardScores } from "../utils/eventUtils";
import { logToWebhook } from "../utils/logHandler";
import { hasRole } from "../utils/userUtils";

async function getCompletedEvents(client: OWSClient) {
  const response = await client.events.eventsControllerFind({
    status: EventDtoStatusEnum.Completed,
  });

  const eventDocs = response.data;
  return eventDocs;
}

async function getRoleMapping(
  guild: Guild,
  readerRoles: GuildsConfig["readerRoles"],
) {
  const roles: [Role, number][] = [];
  for (const readerRole of readerRoles) {
    const role = await guild.roles.fetch(readerRole.role);
    if (!role) {
      throw new Error(`Role ${readerRole.role} not found!`);
    }
    roles.push([role, readerRole.points]);
  }
  return roles;
}

async function updateMemberRole(
  roleWithPoints: [Role, number],
  member: GuildMember,
  points: number,
  logWebhookUrl: string,
) {
  const [requiredRole, requiredPoints] = roleWithPoints;

  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle("Reader Role Update")
    .setTimestamp();

  if (hasRole(member, requiredRole.id) && points < requiredPoints) {
    await member.roles.remove(requiredRole);

    embed.setDescription(
      `${roleMention(requiredRole.id)} removed from ${userMention(member.id)}`,
    );
  } else if (!hasRole(member, requiredRole.id) && points >= requiredPoints) {
    await member.roles.add(requiredRole);

    embed.setDescription(
      `${roleMention(requiredRole.id)} added to ${userMention(member.id)}`,
    );
  }
  logToWebhook({ embeds: [embed] }, logWebhookUrl);
}

export const updateReaderRoles: Job = {
  name: "updateReaderRoles",
  cronTime: "0 7 * * *",
  callBack: async (bot) => {
    try {
      const guilds = await getAllGuildConfigs(bot);

      for (const guildDoc of guilds) {
        const readerRoles = guildDoc.config.readerRoles;
        if (readerRoles.length === 0) continue;

        const eventDocs = await getCompletedEvents(bot.api);
        if (eventDocs.length === 0) continue;

        const scores = calculateReaderboardScores(eventDocs);
        const guild = await bot.guilds.fetch(guildDoc.guildId);
        const allMembers = await guild.members.fetch();
        const rolesWithPoints = await getRoleMapping(guild, readerRoles);
        const filteredScores = scores.filter((x) =>
          allMembers.some((member) => member.user.id === x[0]),
        );

        for (const score of filteredScores) {
          const [userId, [_, points]] = score;
          const member = await guild.members.fetch(userId);

          for (const roleWithPoints of rolesWithPoints) {
            const logWebhookUrl = guildDoc.config.logWebhookUrl;
            await updateMemberRole(
              roleWithPoints,
              member,
              points,
              logWebhookUrl,
            );
          }
        }
      }
    } catch (error) {
      await errorHandler(bot, "jobs > updateReaderRoles", error);
    }
  },
};
