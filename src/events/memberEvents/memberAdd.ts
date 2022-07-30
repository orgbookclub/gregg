import { GuildMember, PartialGuildMember } from "discord.js";

import { Bot } from "../../interfaces/Bot";
import { Event } from "../../interfaces/Event";
import { logger } from "../../utils/logHandler";

export const memberAdd: Event = {
  name: "memberAdd",
  // eslint-disable-next-line require-await
  run: async (bot: Bot, member: GuildMember | PartialGuildMember) => {
    try {
      const { user, guild } = member;

      if (!user) {
        return;
      }
      logger.info(`${user.tag} (${user.id}) joined guild ${guild.id}`);
    } catch (err) {
      logger.error(`Error while handling memberAdd event: ${err}`);
    }
  },
};
