import { Guild } from "discord.js";

import { Bot, Event } from "../../models";
import { logger } from "../../utils/logHandler";

export const guildDelete: Event = {
  name: "guildDelete",
  // eslint-disable-next-line require-await
  run: async (bot: Bot, guild: Guild) => {
    logger.info(
      `${bot.user?.username} has been removed from guild: ${guild.name} (${guild.id}) `,
    );

    // TODO: Remove all guild data here.
  },
};
