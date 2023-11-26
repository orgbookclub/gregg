import { EventDocument } from "@orgbookclub/ows-client";
import {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  Colors,
  EmbedBuilder,
  TextChannel,
} from "discord.js";

import { Bot } from "../models";

import { logToWebhook, logger } from "./logHandler";

/**
 * Creates a button action row for event requests and announcements.
 *
 * @param eventId The event id.
 * @param messageType String representing the message type i.e. Request or announcement.
 * @param disabled Should buttons be disabled.
 * @returns A Button actoin row.
 */
export function getButtonActionRow(
  eventId: string,
  messageType: string,
  disabled = false,
) {
  const interestedButton = new ButtonBuilder()
    .setLabel("Join")
    .setEmoji({ name: "✅" })
    .setStyle(ButtonStyle.Success)
    .setCustomId(`${messageType}-${eventId}-interested`)
    .setDisabled(disabled);
  const notInterestedButton = new ButtonBuilder()
    .setLabel("Leave")
    .setEmoji({ name: "⛔" })
    .setStyle(ButtonStyle.Danger)
    .setDisabled(disabled)
    .setCustomId(`${messageType}-${eventId}-notInterested`);
  const buttonActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    interestedButton,
    notInterestedButton,
  );
  return buttonActionRow;
}

/**
 * Deletes a BR Request message.
 *
 * @param bot The bot.
 * @param eventDoc The event doc.
 * @param webhookUrl The webhook url.
 */
export async function deleteBRRequest(
  bot: Bot,
  eventDoc: EventDocument,
  webhookUrl: string,
) {
  const requestMessages = await bot.db.eventMessages.findMany({
    where: {
      eventId: eventDoc._id,
      type: "BRRequest",
    },
  });
  const messageDeleteEmbed = new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle("Message Delete")
    .setDescription(`Deleted BR Request Message for ${eventDoc._id}`)
    .setTimestamp();
  for (const doc of requestMessages) {
    try {
      const channel = (await bot.channels.fetch(doc.channelId)) as TextChannel;
      const message = await channel.messages.fetch(doc.messageId);
      await message.delete();
      await logToWebhook({ embeds: [messageDeleteEmbed] }, webhookUrl);
    } catch (error) {
      logger.error(
        `Unable to delete message ${doc.messageId} in channel ${doc.channelId}`,
      );
    }
  }
}
