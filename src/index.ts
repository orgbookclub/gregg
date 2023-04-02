import * as Sentry from "@sentry/node";
import { Client } from "discord.js";

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

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
  environment: "development",
});

void (async () => {
  logger.debug("Starting process...");
  const bot = new Client({
    intents: IntentOptions,
  }) as Bot;

  logger.debug("Validating environment variables...");
  const validatedEnvironment = validateEnv(bot);
  if (!validatedEnvironment.valid) {
    return;
  }

  /**
   * Fallthrough error handlers. These fire in rare cases where something throws
   * in a way that our standard catch block cannot see it.
   */
  process.on("unhandledRejection", async (error: Error) => {
    await errorHandler(bot, "Unhandled Rejection Error", error);
  });

  process.on("uncaughtException", async (error) => {
    await errorHandler(bot, "Uncaught Exception Error", error);
  });

  logger.debug("Loading Commands...");
  const commands = await loadCommands();
  const contexts = await loadContexts();
  bot.commands = commands;
  bot.contexts = contexts;
  if (!commands.length || !contexts.length) {
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
  await bot.login(bot.configs.token);

  logger.debug("Initializing API Client...");
  await loadApiClient(bot);
})();
