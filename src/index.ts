import { Client } from 'discord.js';
import { IntentOptions } from './config/IntentOptions';
import { handleEvents } from './events/handleEvents';
import { Bot } from './interfaces/Bot';
import { loadCommands } from './utils/loadCommands';
import { logger } from './utils/logHandler';
import { registerCommands } from './utils/registerCommands';
import { validateEnv } from './validateEnv';

void (async () => {
  logger.debug('Starting process...');
  const bot = new Client({
    intents: IntentOptions,
  }) as Bot;

  logger.debug('Validating environment variables...');
  const validatedEnvironment = validateEnv(bot);
  if (!validatedEnvironment.valid) {
    return;
  }

  logger.debug('Loading Commands...');
  const commands = await loadCommands(bot);
  bot.commands = commands;
  if (!commands.length) {
    return;
  }

  logger.debug('Registering Commands...');
  const success = await registerCommands(bot);
  if (!success) {
    return;
  }

  logger.debug('Attaching event listeners...');
  handleEvents(bot);
  await bot.login(bot.configs.token);
})();
