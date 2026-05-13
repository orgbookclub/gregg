import {
  EventDtoStatusEnum,
  EventsV2ControllerFindStatusEnum,
} from "@organizedbookclub/ows-client";
import { captureCheckIn } from "@sentry/node";

import { Job } from "../models";
import { getAllGuildConfigs } from "../utils/dbUtils";
import { errorHandler } from "../utils/errorHandler";
import { findAllEvents } from "../utils/eventsApi";
import { getEventUpdateLogEmbed } from "../utils/eventUtils";
import { logToWebhook } from "../utils/logHandler";

const START_EVENT_FIELDS = "book,status,dates.startDate,dates.endDate";

const jobName = "startAnnouncedEvents";

const cronTime = "0 6 * * *";
export const startAnnouncedEvents: Job = {
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
        if (!guildDoc.config.enableEventJobs) {
          continue;
        }
        const now = new Date(Date.now());
        const eventDocs = await findAllEvents(
          bot,
          {
            status: EventsV2ControllerFindStatusEnum.Announced,
            startDateBefore: now.toISOString(),
            endDateAfter: now.toISOString(),
          },
          START_EVENT_FIELDS,
        );
        for (const eventDoc of eventDocs) {
          const response = await bot.api.events.eventsControllerUpdate({
            id: eventDoc._id,
            updateEventDto: { status: EventDtoStatusEnum.Ongoing },
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
