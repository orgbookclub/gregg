import { PrismaClient } from "@prisma/client";
import { Client } from "discord.js";

import { OWSClient } from "../providers/owsClient";

import { Command } from "./Command";
import { SprintManager } from "./commands/sprint/SprintManager";
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
    owsUrl: string;
    clientSecret: string;
  };

  api: OWSClient;

  dataCache: {
    sprintManager: SprintManager;
  };

  db: PrismaClient;
  cooldowns: Record<string, Record<string, number>>;
}
