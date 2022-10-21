import { Bot } from "../interfaces/Bot";
import { APIClient } from "../providers/ows/apiClient";

import { logger } from "./logHandler";

/**
 * Initializes and attaches the backend API client to the bot instance.
 *
 * @param {Bot} bot The discord bot instance.
 */
export const loadApiClient = async (bot: Bot): Promise<void> => {
  try {
    const client = new APIClient();
    await client.initialize();
    bot.apiClient = client;
  } catch (err) {
    logger.error(`Error while loading API Client: ${err}`);
  }
};
