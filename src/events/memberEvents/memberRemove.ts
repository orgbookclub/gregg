import { Events, GuildMember, PartialGuildMember } from "discord.js";

import { Bot, Event } from "../../models";
import { logger } from "../../utils/logHandler";

export const memberRemove: Event = {
  name: Events.GuildMemberRemove,
  // eslint-disable-next-line require-await
  run: async (bot: Bot, member: GuildMember | PartialGuildMember) => {
    try {
      const { user, guild } = member;

      if (!user) {
        return;
      }

      // TODO: Clean up a user's data when they leave the guild.
      logger.info(`${user.tag} (${user.id}) left guild ${guild.id}`);
    } catch (err) {
      logger.error(err, `Error while handling memberRemove event`);
    }
  },
};
