import { Bot } from '../interfaces/Bot';
import { ready } from './clientEvents/ready';
import { interactionCreate } from './interactionEvents/interactionCreate';

/**
 * Root level function for loading all of the event listeners
 * @param bot the bot instance
 */
export const handleEvents = (bot: Bot): void => {
  bot.on('ready', async () => {
    await ready.execute(bot);
  });
  bot.on('interactionCreate', async (interaction) => {
    await interactionCreate.execute(bot, interaction);
  });
};
