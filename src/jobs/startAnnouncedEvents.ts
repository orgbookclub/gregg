import { EventDtoStatusEnum } from "@orgbookclub/ows-client";

import { Job } from "../models";
import { getAllGuildConfigs } from "../utils/dbUtils";
import { errorHandler } from "../utils/errorHandler";
import { getEventUpdateLogEmbed } from "../utils/eventUtils";
import { logToWebhook } from "../utils/logHandler";

export const startAnnouncedEvents: Job = {
  name: "startAnnouncedEvents",
  cronTime: "0 6 * * *",
  callBack: async (bot) => {
    try {
      const guilds = await getAllGuildConfigs(bot);
      for (const guildDoc of guilds) {
        const now = new Date(Date.now());
        const eventDocs = (
          await bot.api.events.eventsControllerFind({
            status: EventDtoStatusEnum.Announced,
            startDateBefore: now.toISOString(),
            endDateAfter: now.toISOString(),
          })
        ).data;
        for (const eventDoc of eventDocs) {
          const response = await bot.api.events.eventsControllerUpdate({
            id: eventDoc._id,
            updateEventDto: { status: EventDtoStatusEnum.Ongoing },
          });
          const updatedEventDoc = response.data;
          const embed = getEventUpdateLogEmbed(eventDoc, updatedEventDoc);
          logToWebhook({ embeds: [embed] }, guildDoc.config.logWebhookUrl);
        }
      }
    } catch (error) {
      await errorHandler(bot, "jobs > startAnnouncedEvents", error);
    }
  },
};
