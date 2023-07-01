import { GuildMember, PartialGuildMember } from "discord.js";

import { Bot } from "../../models/Bot";
import { Event } from "../../models/Event";
import { logger } from "../../utils/logHandler";

export const memberRemove: Event = {
  name: "memberRemove",
  // eslint-disable-next-line require-await
  run: async (bot: Bot, member: GuildMember | PartialGuildMember) => {
    try {
      const { user, guild } = member;

      if (!user) {
        return;
      }
      logger.info(`${user.tag} (${user.id}) left guild ${guild.id}`);
    } catch (err) {
      logger.error(err, `Error while handling memberRemove event`);
    }
  },
};
