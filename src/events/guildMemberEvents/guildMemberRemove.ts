import { Events, GuildMember, PartialGuildMember } from "discord.js";

import { Bot, Event } from "../../models";
import { logger } from "../../utils/logHandler";

const guildMemberRemove: Event = {
  name: Events.GuildMemberRemove,
  run: async (bot: Bot, member: GuildMember | PartialGuildMember) => {
    try {
      const { user, guild } = member;

      if (!user) {
        return;
      }

      await deleteMemberFromDb(bot, member);

      logger.info(`${user.tag} (${user.id}) left guild ${guild.id}`);
    } catch (error) {
      logger.error(error, `Error in ${Events.GuildMemberRemove}`);
    }
  },
};

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
