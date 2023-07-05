import { PrismaClient } from "@prisma/client";
import { Client } from "discord.js";

import { OWSClient } from "../providers/owsClient";

import { Command } from "./Command";
import { Context } from "./Context";

import { SprintManager } from ".";

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
