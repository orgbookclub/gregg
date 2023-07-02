import { Bot, Event } from "../../models";
import { logger } from "../../utils/logHandler";

export const disconnect: Event = {
  name: "disconnect",
  // eslint-disable-next-line require-await
  run: async (bot: Bot) => {
    logger.info(`${bot.user?.tag} disconnected`);
  },
};
