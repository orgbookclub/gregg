import { Events, ThreadChannel } from "discord.js";

import { Bot, Event } from "../../models";
import { logger } from "../../utils/logHandler";

export const threadCreate: Event = {
  name: Events.ThreadCreate,
  run: async (bot: Bot, thread: ThreadChannel) => {
    try {
      if (thread.joinable) {
        await thread.join();
      }
    } catch (error) {
      logger.error(error, `Error in ${Events.ThreadCreate}`);
    }
  },
};
