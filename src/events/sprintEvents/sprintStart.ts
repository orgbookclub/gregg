import { TextChannel } from "discord.js";

import { Bot, Sprint, SprintStatus, Event } from "../../models";
import { logger } from "../../utils/logHandler";

export const sprintStart: Event = {
  name: "sprintStart",
  run: async (bot: Bot, sprint: Sprint) => {
    try {
      logger.debug(
        `sprintStart event fired for sprint ${JSON.stringify(sprint)}`,
      );
      sprint.status = SprintStatus.Ongoing;
      sprint.timer = setTimeout(() => {
        bot.emit("sprintFinish", sprint);
      }, sprint.duration * 60 * 1000);
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
        content: sprint.getStartMessage(),
      });
    } catch (err) {
      logger.error(err, `Error while handling sprintStart event`);
    }
  },
};
