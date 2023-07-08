import { Bot } from "../models";
import { OWSClient } from "../providers/owsClient";

import { logger } from "./logHandler";

/**
 * Initializes and attaches the backend API client to the bot instance.
 *
 * @param bot The discord bot instance.
 */
export const loadApiClient = async (bot: Bot) => {
  try {
    const client = new OWSClient(bot.configs.apiUrl);
    await client.initialize();
    bot.api = client;
  } catch (err) {
    logger.error(err, `Error while loading API Client`);
  }
};
