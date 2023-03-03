import { Bot } from "../interfaces/Bot";
import { OWSClient } from "../providers/owsClient";

import { logger } from "./logHandler";

/**
 * Initializes and attaches the backend API client to the bot instance.
 *
 * @param {Bot} bot The discord bot instance.
 */
export const loadApiClient = async (bot: Bot): Promise<void> => {
  try {
    const client = new OWSClient();
    await client.initialize();
    bot.apiClient = client;
  } catch (err) {
    logger.error(`Error while loading API Client: ${err}`);
  }
};
