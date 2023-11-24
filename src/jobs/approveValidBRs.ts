import { EventDtoStatusEnum, EventDtoTypeEnum } from "@orgbookclub/ows-client";

import { Job } from "../models";
import { getAllGuildConfigs } from "../utils/dbUtils";
import { errorHandler } from "../utils/errorHandler";
import { getEventUpdateLogEmbed } from "../utils/eventUtils";
import { logToWebhook } from "../utils/logHandler";

export const approveValidBRs: Job = {
  name: "approveValidBRs",
  cronTime: "4 */12 * * *",
  callBack: async (bot) => {
    try {
      const guilds = await getAllGuildConfigs(bot);
      for (const guildDoc of guilds) {
        const nowPlus10Days = new Date(Date.now() + 10 * 24 * 3600 * 1000);
        const eventDocs = (
          await bot.api.events.eventsControllerFind({
            status: EventDtoStatusEnum.Requested,
            type: EventDtoTypeEnum.BuddyRead,
            startDateBefore: nowPlus10Days.toISOString(),
          })
        ).data;
        const minParticipantCount = guildDoc.config.minParticipantCount;
        for (const eventDoc of eventDocs) {
          if (
            eventDoc.interested.length >= minParticipantCount &&
            eventDoc.leaders.length > 0
          ) {
            const updatedEventDoc = (
              await bot.api.events.eventsControllerUpdate({
                id: eventDoc._id,
                updateEventDto: { status: EventDtoStatusEnum.Approved },
              })
            ).data;
            const embed = getEventUpdateLogEmbed(eventDoc, updatedEventDoc);
            logToWebhook({ embeds: [embed] }, guildDoc.config.logWebhookUrl);
          }
        }
      }
    } catch (error) {
      await errorHandler(bot, "jobs > approveValidBRs", error);
    }
  },
};
