import { PrismaClient } from "@prisma/client";
import { Client, WebhookClient } from "discord.js";

import { OWSClient } from "../providers/owsClient";

import { Command } from "./commands/Command";
import { SprintManager } from "./commands/sprint/SprintManager";
import { Context } from "./contexts/Context";
import { JobManager } from "./jobs/JobManager";

/**
 * Model used to pass around the bot's Discord instance with additional
 * configurations attached.
 */
export interface Bot extends Client {
  commands: Command[];
  contexts: Context[];
  configs: {
    token: string;
    clientId: string;
    clientSecret: string;
    apiUrl: string;
    whUrl: string;
  };
  api: OWSClient;
  db: PrismaClient;
  sprintManager: SprintManager;
  jobManager: JobManager;
  cooldowns: Record<string, Record<string, number>>;
  debugHook: WebhookClient;
}
