import { init } from "@sentry/node";
import { ActivityType, Client, WebhookClient } from "discord.js";

import { IntentOptions } from "./config";
import { connectPrisma } from "./database/connectPrisma";
import { Bot } from "./models";
import { SprintManager } from "./models/commands/sprint/SprintManager";
import { createServer } from "./server/createServer";
import { errorHandler } from "./utils/errorHandler";
import { loadApiClient } from "./utils/loadApiClient";
import { loadCommands, loadContexts } from "./utils/loadCommands";
import { handleEvents } from "./utils/loadEventListeners";
import { logger } from "./utils/logHandler";
import { registerCommands } from "./utils/registerCommands";
import { validateEnv } from "./validateEnv";

init({
  dsn: process.env.SENTRY_DSN,
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
  const bot = new Client({ intents: IntentOptions }) as Bot;

  logger.debug("Validating environment variables...");
  bot.configs = validateEnv();

  logger.debug("Initializing debug webhook...");
  bot.debugHook = new WebhookClient({ url: bot.configs.whUrl });
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

  logger.debug("Loading commands...");
  bot.commands = await loadCommands();
  bot.contexts = await loadContexts();
  if (!bot.commands.length || !bot.contexts.length) {
    logger.error("Failed to import commands");
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    logger.debug("Registering commands in development...");
    const success = await registerCommands(bot);
    if (!success) {
      return;
    }
  }

  logger.debug("Initializing database...");
  bot.db = await connectPrisma();

  logger.debug("Initializing sprint manager...");
  bot.sprintManager = new SprintManager();
  bot.cooldowns = {};

  logger.debug("Attaching event listeners...");
  handleEvents(bot);

  logger.debug("Initializing API Client...");
  await loadApiClient(bot);

  logger.debug("Connecting to Discord...");
  await bot.login(bot.configs.token);

  const server = createServer();
  if (!server) {
    logger.error("Failed to launch web server");
    return;
  }

  logger.debug("Setting activity...");
  bot.user?.setActivity({
    name: "discord.gg/BookClubs",
    type: ActivityType.Watching,
  });
})();
