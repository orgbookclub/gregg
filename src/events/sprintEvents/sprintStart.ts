import { Bot, Event } from "../../models";
import { SprintStatus } from "../../models/commands/sprint/SprintStatus";
import { logger } from "../../utils/logHandler";

export const sprintStart: Event = {
  name: "sprintStart",
  run: async (bot: Bot, sprintId: string) => {
    try {
      const sprint = bot.dataCache.sprintManager.getSprint(sprintId);
      logger.debug(
        `sprintStart event fired for sprint ${JSON.stringify(sprint)}`,
      );
      sprint.startedOn = new Date();
      sprint.status = SprintStatus.Ongoing;
      sprint.timer = setTimeout(() => {
        bot.emit("sprintFinish", sprintId);
      }, sprint.duration * 60 * 1000);

      const threadId = sprint.threadId;
      const channel = await bot.channels.fetch(threadId);
      if (!channel?.isTextBased()) {
        logger.error(
          { threadId: threadId },
          `Unable to find sprint text channel/thread`,
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
