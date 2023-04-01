import { Bot } from "../../models/Bot";
import { Event } from "../../models/Event";
import { logger } from "../../utils/logHandler";

export const disconnect: Event = {
  name: "disconnect",
  // eslint-disable-next-line require-await
  run: async (bot: Bot) => {
    logger.info(`${bot.user?.tag} disconnected`);
  },
};
