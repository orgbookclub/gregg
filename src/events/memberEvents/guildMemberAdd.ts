import { Events, GuildMember, PartialGuildMember, User } from "discord.js";

import { Bot, Event } from "../../models";
import { logger } from "../../utils/logHandler";

const guildMemberAdd: Event = {
  name: Events.GuildMemberAdd,
  run: async (bot: Bot, member: GuildMember | PartialGuildMember) => {
    try {
      const { user } = member;

      if (!user) {
        return;
      }

      await upsertUserInDb(bot, member.user);
      await upsertMemberInDb(bot, member);
    } catch (error) {
      logger.error(error, `Error in ${Events.GuildMemberAdd}`);
    }
  },
};

async function upsertUserInDb(bot: Bot, user: User) {
  await bot.db.users.upsert({
    where: {
      id: user.id,
    },
    update: {},
    create: {
      id: user.id,
      username: user.username,
    },
  });
}

async function upsertMemberInDb(
  bot: Bot,
  member: GuildMember | PartialGuildMember,
) {
  await bot.db.members.upsert({
    where: {
      // eslint-disable-next-line camelcase
      guildId_userId: {
        guildId: member.guild.id,
        userId: member.user.id,
      },
    },
    update: {},
    create: {
      guildId: member.guild.id,
      userId: member.user.id,
      joinedAt: member.joinedAt ?? new Date(),
    },
  });
}

export { guildMemberAdd };
