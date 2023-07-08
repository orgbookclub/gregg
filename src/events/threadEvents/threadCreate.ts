import { Events, ThreadChannel } from "discord.js";

import { Bot, Event } from "../../models";
import { errorHandler } from "../../utils/errorHandler";

export const threadCreate: Event = {
  name: Events.ThreadCreate,
  run: async (bot: Bot, thread: ThreadChannel) => {
    try {
      if (thread.joinable) {
        await thread.join();
      }
    } catch (error) {
      errorHandler(
        bot,
        `events > ${Events.ThreadCreate}`,
        error,
        thread.guild.name,
      );
    }
  },
};
