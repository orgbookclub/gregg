import { TextChannel } from "discord.js";

import Sprint from "../../classes/Sprint";
import { SprintStatus } from "../../classes/SprintStatus";
import { Bot } from "../../interfaces/Bot";
import { Event } from "../../interfaces/Event";
import { logger } from "../../utils/logHandler";

export const sprintFinish: Event = {
  name: "sprintFinish",
  // eslint-disable-next-line require-await
  run: async (bot: Bot, sprint: Sprint) => {
    try {
      logger.debug(
        `sprintFinish event fired for sprint ${JSON.stringify(sprint)}`,
      );
      sprint.status = SprintStatus.Finished;
      sprint.timer = setTimeout(() => {
        bot.emit("sprintEnd", sprint);
      }, 2 * 60 * 1000);
      const threadId = sprint.threadId;
      const channel = (await bot.channels.fetch(threadId)) as TextChannel;
      if (channel === null) {
        logger.error(`Unable to find channel/thread with ID: ${threadId}`);
        return;
      }
      channel.send({
        content: sprint.getFinishMessage(),
      });
    } catch (err) {
      logger.error(`Error while handling sprintFinish event ${err}`);
    }
  },
};
