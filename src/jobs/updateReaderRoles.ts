import { EventDtoStatusEnum } from "@orgbookclub/ows-client";
import { GuildsConfig } from "@prisma/client";
import { Guild, Role, roleMention, userMention } from "discord.js";

import { Bot, Job } from "../models";
import { OWSClient } from "../providers/owsClient";
import { getAllGuildConfigs } from "../utils/dbUtils";
import { calculateReaderboardScores } from "../utils/eventUtils";
import { logToWebhook, logger } from "../utils/logHandler";
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

export const updateReaderRoles: Job = {
  name: "updateReaderRoles",
  cronTime: "0 23 * * *",
  callBack: async (bot: Bot) => {
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
          const [requiredRole, requiredPoints] = roleWithPoints;

          if (hasRole(member, requiredRole.id) && points < requiredPoints) {
            member.roles.remove(requiredRole);
            logger.debug(
              `Removing ${requiredRole.name} from member ${member.user.username} in ${guild.name}`,
            );
            logToWebhook(
              `${roleMention(requiredRole.id)} removed from ${userMention(
                member.id,
              )}`,
              guildDoc.config.logWebhookUrl,
            );
          } else if (
            !hasRole(member, requiredRole.id) &&
            points >= requiredPoints
          ) {
            member.roles.add(requiredRole);
            logger.debug(
              `Adding ${requiredRole.name} to member ${member.user.username} in ${guild.name}`,
            );
            logToWebhook(
              `${roleMention(requiredRole.id)} added to ${userMention(
                member.id,
              )}`,
              guildDoc.config.logWebhookUrl,
            );
          }
        }
      }
    }
  },
};
