import { Client } from "discord.js";

import { APIClient } from "../providers/apiClient";

import { Command } from "./Command";
import { Context } from "./Context";

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
  apiClient: APIClient;
}
