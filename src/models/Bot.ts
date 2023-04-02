import { Client } from "discord.js";

import { OWSClient } from "../providers/owsClient";

import { Command } from "./Command";
import { Context } from "./Context";
import SprintManager from "./SprintManager";

/**
 * An Instance of a Discord Client.
 */
export interface Bot extends Client {
  commands: Command[];
  contexts: Context[];
  configs: {
    token: string;
    clientId: string;
    homeGuildId: string;
  };
  api: OWSClient;
  dataCache: {
    sprintManager: SprintManager;
  };
}
