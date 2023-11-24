import { EventDtoStatusEnum } from "@orgbookclub/ows-client";
import { captureCheckIn } from "@sentry/node";

import { Job } from "../models";
import { getAllGuildConfigs } from "../utils/dbUtils";
import { errorHandler } from "../utils/errorHandler";
import { getEventUpdateLogEmbed } from "../utils/eventUtils";
import { logToWebhook } from "../utils/logHandler";

const jobName = "endCompletedEvents";

export const endCompletedEvents: Job = {
  name: jobName,
  cronTime: "40 23 * * *",
  callBack: async (bot) => {
    const checkInId = captureCheckIn({
      monitorSlug: jobName,
      status: "in_progress",
    });

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
          const response = await bot.api.events.eventsControllerUpdate({
            id: eventDoc._id,
            updateEventDto: { status: EventDtoStatusEnum.Completed },
          });
          const updatedEventDoc = response.data;
          const embed = getEventUpdateLogEmbed(eventDoc, updatedEventDoc);
          await logToWebhook(
            { embeds: [embed] },
            guildDoc.config.logWebhookUrl,
          );
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
