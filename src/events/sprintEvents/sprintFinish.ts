import { Bot, Event } from "../../models";
import { SprintStatus } from "../../models/commands/sprint/SprintStatus";
import { logger } from "../../utils/logHandler";

export const sprintFinish: Event = {
  name: "sprintFinish",
  run: async (bot: Bot, sprintId: string) => {
    try {
      const sprint = bot.dataCache.sprintManager.getSprint(sprintId);
      logger.debug(
        `sprintFinish event fired for sprint ${JSON.stringify(sprint)}`,
      );
      sprint.status = SprintStatus.Finished;
      sprint.timer = setTimeout(() => {
        bot.emit("sprintEnd", sprintId);
      }, 2 * 60 * 1000);
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
        content: sprint.getFinishMessage(),
      });
    } catch (err) {
      logger.error(err, `Error while handling sprintFinish event`);
    }
  },
};
