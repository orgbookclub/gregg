import { Bot } from "../../models";
import { errorHandler } from "../../utils/errorHandler";
import { logger } from "../../utils/logHandler";

import { EngineClient } from "./client";
import { EngineService } from "./service";

/**
 * Creates the engine client and attaches the engine service to the bot.
 * Fetches an app token eagerly so bad credentials surface at boot.
 *
 * @param bot The bot instance.
 */
export const loadEngine = async (bot: Bot) => {
  const config = bot.configs.engine;
  if (!config) return;
  const client = new EngineClient({
    baseUrl: config.url,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });
  bot.engine = new EngineService(bot, client);
  try {
    await client.getAppToken();
    logger.info(`Connected to the ows-next engine at ${client.baseUrl}`);
  } catch (err) {
    await errorHandler(bot, "index > loadEngine", err);
  }
};
