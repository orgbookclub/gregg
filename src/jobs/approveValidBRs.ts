import {
  EventDtoStatusEnum,
  EventsV2ControllerFindStatusEnum,
  EventsV2ControllerFindTypeEnum,
} from "@organizedbookclub/ows-client";
import { captureCheckIn } from "@sentry/node";

import { Job } from "../models";
import { getAllGuildConfigs } from "../utils/dbUtils";
import { errorHandler } from "../utils/errorHandler";
import { findAllEvents } from "../utils/eventsApi";
import { updateEventState } from "../utils/eventUtils";

const APPROVE_BR_FIELDS =
  "book,status,dates.startDate,dates.endDate,interested,leaders";

const jobName = "approveValidBRs";

const cronTime = "30 7 * * *";

const approveValidBRs: Job = {
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
        const nowPlus10Days = new Date(Date.now() + 10 * 24 * 3600 * 1000);
        const eventDocs = await findAllEvents(
          bot,
          {
            status: EventsV2ControllerFindStatusEnum.Requested,
            type: EventsV2ControllerFindTypeEnum.BuddyRead,
            startDateBefore: nowPlus10Days.toISOString(),
          },
          APPROVE_BR_FIELDS,
        );
        const minParticipantCount = guildDoc.config.minParticipantCount;
        for (const eventDoc of eventDocs) {
          if (
            eventDoc.interested.length >= minParticipantCount &&
            eventDoc.leaders.length > 0
          ) {
            await updateEventState(
              bot,
              eventDoc,
              guildDoc.config.logWebhookUrl,
              EventDtoStatusEnum.Approved,
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

export { approveValidBRs };
