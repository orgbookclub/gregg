import { Events } from "discord.js";

import { Bot, Event } from "../../models";
import { logger } from "../../utils/logHandler";

export const ready: Event = {
  name: Events.ClientReady,
  // eslint-disable-next-line require-await
  run: async (bot: Bot) => {
    logger.info(`Ready! Logged in as ${bot.user?.username}`);

    // TODO: Possibility of loading scheduled events from DB here
    // Things like cron jobs etc.
  },
};
