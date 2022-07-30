import { Client } from 'discord.js';
import { IntentOptions } from './config/IntentOptions';
import { handleEvents } from './events/handleEvents';
import { Bot } from './interfaces/Bot';
import { loadCommands } from './utils/loadCommands';
import { registerCommands } from './utils/registerCommands';
import { validateEnv } from './validateEnv';

void (async () => {
  const bot = new Client({
    intents: IntentOptions,
  }) as Bot;

  const validatedEnvironment = validateEnv(bot);
  if (!validatedEnvironment.valid) {
    return;
  }

  const commands = await loadCommands(bot);
  bot.commands = commands;
  if (!commands.length) {
    return;
  }

  const success = await registerCommands(bot);
  if (!success) {
    return;
  }

  handleEvents(bot);
  await bot.login(bot.configs.token);
})();
