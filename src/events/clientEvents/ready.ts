import { Bot } from '../../interfaces/Bot';
import { logger } from '../../utils/logHandler';

export const ready = {
  name: 'ready',
  execute: async (bot: Bot): Promise<void> => {
    logger.info(`Ready! Logged in as ${bot.user?.tag}`);
  },
};
