import { Events, Guild } from "discord.js";

import { Bot, Event } from "../../models";
import { errorHandler } from "../../utils/errorHandler";
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
      await errorHandler(
        bot,
        `events > ${Events.GuildCreate}`,
        error,
        guild.name,
      );
    }
  },
};

async function createGuildInDb(bot: Bot, guild: Guild) {
  await bot.db.guilds.create({
    data: {
      guildId: guild.id,
      name: guild.name,
      ownerId: guild.ownerId,
      region: guild.preferredLocale,
      createdAt: guild.createdAt,
      joinedAt: guild.joinedAt,
      config: {},
    },
  });
}

export { guildCreate };
