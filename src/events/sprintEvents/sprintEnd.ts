import { TextChannel } from "discord.js";

import Sprint from "../../classes/Sprint";
import { Bot } from "../../interfaces/Bot";
import { Event } from "../../interfaces/Event";
import { logger } from "../../utils/logHandler";

export const sprintEnd: Event = {
  name: "sprintEnd",
  // eslint-disable-next-line require-await
  run: async (bot: Bot, sprint: Sprint) => {
    try {
      logger.debug(
        `sprintEnd event fired for sprint ${JSON.stringify(sprint)}`,
      );
      const threadId = sprint.threadId;
      const channel = (await bot.channels.fetch(threadId)) as TextChannel;
      if (channel === null) {
        logger.error(`Unable to find channel/thread with ID: ${threadId}`);
        return;
      }
      channel.send({
        content: `${sprint.getEndMessage()}`,
      });
    } catch (err) {
      logger.error(`Error while handling sprintEnd event ${err}`);
    }
  },
};
