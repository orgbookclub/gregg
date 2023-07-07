import { Events, Guild } from "discord.js";

import { Bot, Event } from "../../models";
import { logger } from "../../utils/logHandler";

const guildCreate: Event = {
  name: Events.GuildCreate,
  run: async (bot: Bot, guild: Guild) => {
    try {
      logger.info(
        `${bot.user?.username} has been added to guild: ${guild.name} (${guild.id}) `,
      );

      await createGuildInDb(bot, guild);
    } catch (error) {
      logger.error(error, `Error in ${Events.GuildCreate}`);
    }
  },
};

async function createGuildInDb(bot: Bot, guild: Guild) {
  await bot.db.guilds.create({
    data: {
      id: guild.id,
      name: guild.name,
      ownerId: guild.ownerId,
      region: guild.preferredLocale,
      createdAt: guild.createdAt,
      joinedAt: guild.joinedAt,
    },
  });
}

export { guildCreate };
