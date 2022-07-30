import { Bot } from '../../interfaces/Bot';
import { Event } from '../../interfaces/Event';
import { logger } from '../../utils/logHandler';

export const ready: Event = {
  name: 'ready',
  once: true,
  run: async (bot: Bot) => {
    logger.info(`Ready! Logged in as ${bot.user?.tag}`);
  },
};
