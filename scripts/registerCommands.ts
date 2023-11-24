import {
  REST,
  RESTPostAPIApplicationCommandsJSONBody,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  Routes,
} from "discord.js";

import { loadCommands, loadContexts } from "../src/utils/loadCommands";

const BOT_TOKEN = "";
const CLIENT_ID = "";
const GUILD_ID = "";

void (async () => {
  const rest = new REST().setToken(BOT_TOKEN);
  const commandData: (
    | RESTPostAPIApplicationCommandsJSONBody
    | RESTPostAPIChatInputApplicationCommandsJSONBody
  )[] = [];

  const commands = await loadCommands();
  const contexts = await loadContexts();

  commands.forEach((command) => {
    const data =
      command.data.toJSON() as RESTPostAPIApplicationCommandsJSONBody;
    data.options?.sort((a, b) => a.name.localeCompare(b.name));
    commandData.push(data);
  });
  contexts.forEach((context) => commandData.push(context.data));

  // Global registration
  await rest.put(Routes.applicationCommands(CLIENT_ID), {
    body: commandData,
  });

  // Guild registration
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commandData,
  });
})();
