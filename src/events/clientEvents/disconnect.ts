import { Bot } from '../../interfaces/Bot';
import { Event } from '../../interfaces/Event';
import { logger } from '../../utils/logHandler';

export const disconnect: Event = {
  name: 'disconnect',
  run: async (bot: Bot) => {
    logger.info(`${bot.user?.tag} disconnected`);
  },
};
