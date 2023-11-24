import { Colors, EmbedBuilder, WebhookClient } from "discord.js";
import pino from "pino";

import { customSubstring } from "./stringUtils";

function getLogEmbed(message: string) {
  const logEmbed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setDescription(customSubstring(message, 2000))
    .setTimestamp();
  return logEmbed;
}

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
 * @param message The message.
 * @param url The webhook url.
 */
export const logToWebhook = (message: string, url: string) => {
  if (!url || url === "") return;
  const client = new WebhookClient({ url: url });
  client.send({ embeds: [getLogEmbed(message)] });
};
