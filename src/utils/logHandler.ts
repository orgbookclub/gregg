import {
  MessagePayload,
  WebhookClient,
  WebhookMessageCreateOptions,
} from "discord.js";
import pino from "pino";

/**
 * Log Handler using pino.
 */
export const logger = pino({
  name: "gregg",
  level: "debug",
  transport: {
    target: "pino-pretty",
  },
});

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
