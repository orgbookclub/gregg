import { captureCheckIn } from "@sentry/node";

import { Job } from "../models";
import { errorHandler } from "../utils/errorHandler";

const jobName = "syncEngineTierRoles";
const cronTime = "20 * * * *";

/**
 * Pushes each linked guild's role catalogue to the engine and mirrors the
 * engine's reader tier assignments onto Discord roles.
 */
export const syncEngineTierRoles: Job = {
  backends: ["engine"],
  name: jobName,
  cronTime: cronTime,
  callBack: async (bot) => {
    const checkInId = captureCheckIn(
      { monitorSlug: jobName, status: "in_progress" },
      { schedule: { type: "crontab", value: cronTime } },
    );
    try {
      await bot.engine?.pushRoleCatalogs();
      await bot.engine?.syncTierRoles();
      captureCheckIn({ checkInId, monitorSlug: jobName, status: "ok" });
    } catch (error) {
      await errorHandler(bot, `jobs > ${jobName}`, error);
      captureCheckIn({ checkInId, monitorSlug: jobName, status: "error" });
    }
  },
};
