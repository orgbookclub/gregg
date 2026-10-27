import { Job } from "../models";
import { errorHandler } from "../utils/errorHandler";

const jobName = "pollEngineFeed";
const cronTime = "*/15 * * * * *";

/**
 * Follows each linked club's engine feed and refreshes the Discord request
 * and announcement messages of changed events.
 */
export const pollEngineFeed: Job = {
  backends: ["engine"],
  name: jobName,
  cronTime: cronTime,
  callBack: async (bot) => {
    try {
      await bot.engine?.pollFeeds();
    } catch (error) {
      await errorHandler(bot, `jobs > ${jobName}`, error);
    }
  },
};
