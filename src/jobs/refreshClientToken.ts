import { Job } from "../models";
import { errorHandler } from "../utils/errorHandler";

export const refreshClientToken: Job = {
  name: "refreshClientToken",
  cronTime: "*/60 * * * *",
  callBack: async (bot) => {
    try {
      await bot.api.initialize();
    } catch (error) {
      await errorHandler(bot, "jobs > refreshClientToken", error);
    }
  },
};
