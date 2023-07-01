import { Bot } from "../models/Bot";
import { OWSClient } from "../providers/owsClient";

import { logger } from "./logHandler";

/**
 * Initializes and attaches the backend API client to the bot instance.
 *
 * @param bot The discord bot instance.
 */
export const loadApiClient = async (bot: Bot) => {
  try {
    const client = new OWSClient();
    await client.initialize();
    bot.api = client;
  } catch (err) {
    logger.error(err, `Error while loading API Client`);
  }
};
