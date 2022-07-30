import { Bot } from '../../interfaces/Bot';

export const ready = {
  name: 'ready',
  execute: async (bot: Bot): Promise<void> => {
    console.log(`Ready! Logged in as ${bot.user?.tag}`);
  },
};
