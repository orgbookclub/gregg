import { init } from "@sentry/node";
import { ActivityType, Client } from "discord.js";

import { IntentOptions } from "./config/IntentOptions";
import { Bot } from "./models/Bot";
import SprintManager from "./models/SprintManager";
import { errorHandler } from "./utils/errorHandler";
import { loadApiClient } from "./utils/loadApiClient";
import { loadCommands, loadContexts } from "./utils/loadCommands";
import { handleEvents } from "./utils/loadEventListeners";
import { logger } from "./utils/logHandler";
import { registerCommands } from "./utils/registerCommands";
import { validateEnv } from "./validateEnv";

init({
  dsn: process.env.SENTRY_DSN,
  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
  release: `gregg@v${process.env.npm_package_version}`,
  environment: "development",
});

/**
 * This is the entry point for the bot's process. This will log the boot process,
 * call the necessary helpers to prepare the bot, and then log in to Discord.
 */
void (async () => {
  logger.debug("Starting process...");
  const bot = new Client({
    intents: IntentOptions,
  }) as Bot;

  logger.debug("Validating environment variables...");
  bot.configs = validateEnv();

  /**
   * Fallthrough error handlers. These fire in rare cases where something throws
   * in a way that our standard catch block cannot see it.
   */
  process.on("unhandledRejection", (error: Error) => {
    errorHandler(bot, "Unhandled Rejection Error", error);
  });

  process.on("uncaughtException", (error) => {
    errorHandler(bot, "Uncaught Exception Error", error);
  });

  logger.debug("Loading Commands...");
  const commands = await loadCommands();
  const contexts = await loadContexts();
  bot.commands = commands;
  bot.contexts = contexts;
  if (!commands.length || !contexts.length) {
    logger.error("Failed to import commands");
    return;
  }

  logger.debug("Registering Commands...");
  const success = await registerCommands(bot);
  if (!success) {
    return;
  }

  logger.debug("Initializing Cache...");
  bot.dataCache = { sprintManager: new SprintManager() };

  logger.debug("Attaching event listeners...");
  handleEvents(bot);

  logger.debug("Initializing API Client...");
  await loadApiClient(bot);

  logger.debug("Connecting to Discord...");
  await bot.login(bot.configs.token);

  logger.debug("Setting activity...");
  bot.user?.setActivity({
    name: "discord.gg/BookClubs",
    type: ActivityType.Watching,
  });
})();
