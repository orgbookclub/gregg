import {
  REST,
  RESTPostAPIApplicationCommandsJSONBody,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  Routes,
} from "discord.js";

import { Bot } from "../models";

import { logger } from "./logHandler";

/**
 * Takes both the commands and contexts, parses the `data` properties as needed,
 * and builds an array of all command data. Then, posts the data to the Discord endpoint
 * for registering commands.
 *
 * @param bot The bot instance.
 * @returns True if the commands were registered, false on error.
 */
export const registerCommands = async (bot: Bot) => {
  try {
    const rest = new REST().setToken(bot.configs.token);
    const commandData: (
      | RESTPostAPIApplicationCommandsJSONBody
      | RESTPostAPIChatInputApplicationCommandsJSONBody
    )[] = [];

    bot.commands.forEach((command) => {
      const data =
        command.data.toJSON() as RESTPostAPIApplicationCommandsJSONBody;
      data.options?.sort((a, b) => a.name.localeCompare(b.name));
      commandData.push(data);
    });

    bot.contexts.forEach((context) => commandData.push(context.data));
    if (process.env.NODE_ENV === "production") {
      logger.debug("Registering commands globally!");
      await rest.put(Routes.applicationCommands(bot.configs.clientId), {
        body: commandData,
      });
    }

    return true;
  } catch (err) {
    logger.error(err, `Error registering commands`);
    return false;
  }
};
