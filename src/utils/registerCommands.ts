import { REST } from "@discordjs/rest";
import {
  RESTPostAPIApplicationCommandsJSONBody,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  Routes,
} from "discord-api-types/v10";

import { Bot } from "../models/Bot";

import { logger } from "./logHandler";

/**
 * Takes the commands, parses the `data` properties as needed,
 * and builds an array of all command data. Then, posts the data to the Discord endpoint
 * for registering commands.
 *
 * Registers commands in the home guild.
 *
 * @param {Bot} bot The bot instance.
 * @returns {boolean} True if the commands were registered, false on error.
 */
export const registerCommands = async (bot: Bot): Promise<boolean> => {
  try {
    const rest = new REST({ version: "10" }).setToken(bot.configs.token);
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
    logger.debug(`Registering commands in guild: ${bot.configs.homeGuildId}`);
    await rest.put(
      Routes.applicationGuildCommands(
        bot.configs.clientId,
        bot.configs.homeGuildId,
      ),
      { body: commandData },
    );

    return true;
  } catch (err) {
    logger.error(`Error registering commands: ${err}`);
    return false;
  }
};
