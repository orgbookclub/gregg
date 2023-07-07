import { Events } from "discord.js";

import { Bot, Event } from "../../models";
import { logger } from "../../utils/logHandler";

export const disconnect: Event = {
  name: Events.ShardDisconnect,
  // eslint-disable-next-line require-await
  run: async (bot: Bot) => {
    logger.info(`${bot.user?.username} shard disconnected from Discord`);
  },
};
