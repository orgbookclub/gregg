import { Bot } from "../../interfaces/Bot";
import { Event } from "../../interfaces/Event";
import { logger } from "../../utils/logHandler";

export const ready: Event = {
  name: "ready",
  // eslint-disable-next-line require-await
  run: async (bot: Bot) => {
    logger.info(`Ready! Logged in as ${bot.user?.tag}`);
  },
};
