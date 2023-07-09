import { Bot } from "../models";
import { OWSClient } from "../providers/owsClient";

import { errorHandler } from "./errorHandler";

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
    errorHandler(bot, "index > loadApiClient", err);
  }
};
