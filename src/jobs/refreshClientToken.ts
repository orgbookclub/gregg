import { Job, Bot } from "../models";

export const refreshClientToken: Job = {
  name: "refreshClientToken",
  cronTime: "*/60 * * * *",
  callBack: async (bot: Bot) => {
    await bot.api.initialize();
  },
};
