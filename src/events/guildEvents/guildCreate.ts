import { Events, Guild } from "discord.js";

import { Bot, Event } from "../../models";
import { logger } from "../../utils/logHandler";

export const guildCreate: Event = {
  name: Events.GuildCreate,
  // eslint-disable-next-line require-await
  run: async (bot: Bot, guild: Guild) => {
    logger.info(
      `${bot.user?.username} has been added to guild: ${guild.name} (${guild.id}) `,
    );

    // TODO: Possibilty of storing adding server level info to gregg db here.
  },
};
