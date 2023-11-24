import { createWriteStream } from "fs";

import {
  MessagePayload,
  WebhookClient,
  WebhookMessageCreateOptions,
} from "discord.js";
import pino, { multistream } from "pino";
import pretty from "pino-pretty";

const logStreams = [
  { stream: createWriteStream("logs/info.stream.out") },
  { level: "debug", stream: pretty() },
  { level: "debug", stream: createWriteStream("logs/debug.stream.out") },
  { level: "fatal", stream: createWriteStream("logs/fatal.stream.out") },
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
export const logToWebhook = (
  message: string | MessagePayload | WebhookMessageCreateOptions,
  url: string,
) => {
  if (!url || url === "") return;
  const client = new WebhookClient({ url: url });
  client.send(message);
};
