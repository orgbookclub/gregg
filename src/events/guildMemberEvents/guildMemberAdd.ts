import { Events, GuildMember, PartialGuildMember, User } from "discord.js";

import { Bot, Event } from "../../models";
import { errorHandler } from "../../utils/errorHandler";

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
      errorHandler(
        bot,
        `events > ${Events.GuildMemberAdd}`,
        error,
        member.guild.name,
      );
    }
  },
};

async function upsertUserInDb(bot: Bot, user: User) {
  await bot.db.users.upsert({
    where: {
      userId: user.id,
    },
    update: {},
    create: {
      userId: user.id,
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
