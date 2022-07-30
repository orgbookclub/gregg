import { REST } from '@discordjs/rest';
import {
  RESTPostAPIApplicationCommandsJSONBody,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  Routes,
} from 'discord-api-types/v10';
import { Bot } from '../interfaces/Bot';

export const registerCommands = async (bot: Bot): Promise<boolean> => {
  try {
    const rest = new REST({ version: '10' }).setToken(bot.configs.token);
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
    // bot.contexts.forEach((context) => commandData.push(context.data));
    await rest.put(
      Routes.applicationGuildCommands(
        bot.configs.clientId,
        bot.configs.homeGuildId,
      ),
      { body: commandData },
    );

    return true;
  } catch (err) {
    return false;
  }
};
