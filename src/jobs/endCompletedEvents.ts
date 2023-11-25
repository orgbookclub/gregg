import { EventDocument, EventDtoStatusEnum } from "@orgbookclub/ows-client";
import { captureCheckIn } from "@sentry/node";
import { Colors, EmbedBuilder, TextChannel } from "discord.js";

import { Bot, Job } from "../models";
import { getAllGuildConfigs } from "../utils/dbUtils";
import { errorHandler } from "../utils/errorHandler";
import { getEventUpdateLogEmbed } from "../utils/eventUtils";
import { logToWebhook, logger } from "../utils/logHandler";
import { getButtonActionRow } from "../utils/messageUtils";

const jobName = "endCompletedEvents";

const cronTime = "40 23 * * *";
const endCompletedEvents: Job = {
  name: jobName,
  cronTime: cronTime,
  callBack: async (bot) => {
    const checkInId = captureCheckIn(
      {
        monitorSlug: jobName,
        status: "in_progress",
      },
      {
        schedule: {
          type: "crontab",
          value: cronTime,
        },
      },
    );

    try {
      const guilds = await getAllGuildConfigs(bot);
      for (const guildDoc of guilds) {
        const now = new Date(Date.now());
        const eventDocs = (
          await bot.api.events.eventsControllerFind({
            status: EventDtoStatusEnum.Ongoing,
            endDateBefore: now.toISOString(),
          })
        ).data;
        for (const eventDoc of eventDocs) {
          await endEvent(bot, eventDoc, guildDoc.config.logWebhookUrl);
        }
      }

      captureCheckIn({
        checkInId,
        monitorSlug: jobName,
        status: "ok",
      });
    } catch (error) {
      await errorHandler(bot, `jobs > ${jobName}`, error);
      captureCheckIn({
        checkInId,
        monitorSlug: jobName,
        status: "error",
      });
    }
  },
};

async function endEvent(bot: Bot, eventDoc: EventDocument, webhookUrl: string) {
  const response = await bot.api.events.eventsControllerUpdate({
    id: eventDoc._id,
    updateEventDto: { status: EventDtoStatusEnum.Completed },
  });
  const updatedEventDoc = response.data;

  const embed = getEventUpdateLogEmbed(eventDoc, updatedEventDoc);
  await logToWebhook({ embeds: [embed] }, webhookUrl);

  const announcementMessages = await bot.db.eventMessages.findMany({
    where: {
      eventId: eventDoc._id,
      type: "BRRequest",
    },
  });
  const messageDeleteEmbed = new EmbedBuilder()
    .setColor(Colors.Yellow)
    .setTitle("Message Update")
    .setDescription(`Updated BR Announcement Message for ${eventDoc._id}`)
    .setTimestamp();
  for (const doc of announcementMessages) {
    try {
      const channel = (await bot.channels.fetch(doc.channelId)) as TextChannel;
      const message = await channel.messages.fetch(doc.messageId);
      await message.edit({
        components: [getButtonActionRow(eventDoc._id, "ea", true)],
        embeds: message.embeds,
        content: message.content,
      });
      await logToWebhook({ embeds: [messageDeleteEmbed] }, webhookUrl);
    } catch (error) {
      logger.error(
        `Unable to update message ${doc.messageId} in channel ${doc.channelId}`,
      );
    }
  }
}

export { endCompletedEvents };
