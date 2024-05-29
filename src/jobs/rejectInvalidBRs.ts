import { EventDtoStatusEnum, EventDtoTypeEnum } from "@orgbookclub/ows-client";
import { captureCheckIn } from "@sentry/node";

import { Job } from "../models";
import { getAllGuildConfigs } from "../utils/dbUtils";
import { errorHandler } from "../utils/errorHandler";
import { updateEventState } from "../utils/eventUtils";

const jobName = "rejectInvalidBRs";
const cronTime = "10 23 * * *";
const rejectInvalidBRs: Job = {
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
        const eventDocs = (
          await bot.api.events.eventsControllerFind({
            status: EventDtoStatusEnum.Requested,
            type: EventDtoTypeEnum.BuddyRead,
            startDateBefore: now.toISOString(),
          })
        ).data;
        const minParticipantCount = guildDoc.config.minParticipantCount;
        for (const eventDoc of eventDocs) {
          if (
            eventDoc.interested.length < minParticipantCount ||
            eventDoc.leaders.length === 0
          ) {
            const logWebhookUrl = guildDoc.config.logWebhookUrl;
            await updateEventState(
              bot,
              eventDoc,
              logWebhookUrl,
              EventDtoStatusEnum.Rejected,
            );
          }
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

export { rejectInvalidBRs };
