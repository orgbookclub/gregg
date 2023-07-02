import { Bot, Event } from "../../models";
import { logger } from "../../utils/logHandler";

export const ready: Event = {
  name: "ready",
  // eslint-disable-next-line require-await
  run: async (bot: Bot) => {
    logger.info(`Ready! Logged in as ${bot.user?.tag}`);
  },
};
