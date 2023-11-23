import { Events, GuildMember, PartialGuildMember } from "discord.js";

import { Bot, Event } from "../../models";
import { errorHandler } from "../../utils/errorHandler";
import { logger } from "../../utils/logHandler";

const guildMemberRemove: Event = {
  name: Events.GuildMemberRemove,
  run: async (bot: Bot, member: GuildMember | PartialGuildMember) => {
    try {
      const { user, guild } = member;

      if (!user) {
        return;
      }

      const memberDoc = await getMemberFromDb(bot, member);
      if (memberDoc) {
        await deleteMemberFromDb(bot, member);
      }

      logger.info(`${user.tag} (${user.id}) left guild ${guild.id}`);
    } catch (error) {
      await errorHandler(
        bot,
        `events > ${Events.GuildMemberRemove}`,
        error,
        member.guild.name,
      );
    }
  },
};

async function getMemberFromDb(
  bot: Bot,
  member: GuildMember | PartialGuildMember,
) {
  const memberDoc = await bot.db.members.findUnique({
    where: {
      // eslint-disable-next-line camelcase
      guildId_userId: {
        guildId: member.guild.id,
        userId: member.user.id,
      },
    },
  });
  return memberDoc;
}

async function deleteMemberFromDb(
  bot: Bot,
  member: GuildMember | PartialGuildMember,
) {
  await bot.db.members.delete({
    where: {
      // eslint-disable-next-line camelcase
      guildId_userId: {
        guildId: member.guild.id,
        userId: member.user.id,
      },
    },
  });
}

export { guildMemberRemove };
