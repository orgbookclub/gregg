import { Events, Guild } from "discord.js";

import { Bot, Event } from "../../models";
import { errorHandler } from "../../utils/errorHandler";
import { logger } from "../../utils/logHandler";

const guildDelete: Event = {
  name: Events.GuildDelete,
  run: async (bot: Bot, guild: Guild) => {
    try {
      logger.info(
        `${bot.user?.username} has been removed from guild: ${guild.name} (${guild.id}) `,
      );
      await deleteGuildFromDb(bot, guild);
    } catch (error) {
      errorHandler(bot, `events > ${Events.GuildDelete}`, error, guild.name);
    }
  },
};

async function deleteGuildFromDb(bot: Bot, guild: Guild) {
  await bot.db.guilds.delete({
    where: { id: guild.id },
  });
}

export { guildDelete };
