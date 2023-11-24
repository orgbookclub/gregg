import { createWriteStream } from "fs";

import {
  MessagePayload,
  WebhookClient,
  WebhookMessageCreateOptions,
} from "discord.js";
import pino, { multistream } from "pino";
import pretty from "pino-pretty";

const now = new Date().toISOString();

const logStreams = [
  { stream: createWriteStream(`logs/${now}_info.txt`) },
  { level: "debug", stream: pretty() },
  {
    level: "debug",
    stream: createWriteStream(`logs/${now}_debug.txt`, { flags: "r+" }),
  },
  {
    level: "error",
    stream: createWriteStream(`logs/${now}_error.txt`, { flags: "r+" }),
  },
];

/**
 * Log Handler using pino.
 */
export const logger = pino(
  {
    name: "gregg",
    level: "debug",
  },
  multistream(logStreams),
);

/**
 * Sends a message to the log webhook.
 *
 * @param message The message payload.
 * @param url The webhook url.
 */
export const logToWebhook = async (
  message: string | MessagePayload | WebhookMessageCreateOptions,
  url: string,
) => {
  if (!url || url === "") return;
  const client = new WebhookClient({ url: url });
  await client.send(message);
};
