import { TextChannel } from "discord.js";

import { Bot } from "../../models/Bot";
import { Event } from "../../models/Event";
import Sprint from "../../models/Sprint";
import { SprintStatus } from "../../models/SprintStatus";
import { logger } from "../../utils/logHandler";

export const sprintFinish: Event = {
  name: "sprintFinish",
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
        logger.error(
          undefined,
          `Unable to find channel/thread with ID: ${threadId}`,
        );
        return;
      }
      channel.send({
        content: sprint.getFinishMessage(),
      });
    } catch (err) {
      logger.error(err, `Error while handling sprintFinish event`);
    }
  },
};
