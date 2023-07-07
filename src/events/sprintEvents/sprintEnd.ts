import { Bot, Event } from "../../models";
import { logger } from "../../utils/logHandler";

export const sprintEnd: Event = {
  name: "sprintEnd",
  run: async (bot: Bot, sprintId: string) => {
    try {
      const sprint = bot.dataCache.sprintManager.getSprint(sprintId);
      logger.debug(
        `sprintEnd event fired for sprint ${JSON.stringify(sprint)}`,
      );
      sprint.endedOn = new Date();
      const threadId = sprint.threadId;
      const channel = await bot.channels.fetch(threadId);
      if (!channel?.isTextBased()) {
        logger.error(
          { threadId: threadId },
          `Unable to find sprint text channel/thread`,
        );
        return;
      }
      const scores = sprint.calculateSprintScores();

      channel.send({
        content: `${sprint.getEndMessage(scores)}`,
      });
      // Save the sprint in the db
      await bot.db.sprints.create({
        data: {
          duration: sprint.duration,
          threadId: sprint.threadId,
          startedBy: sprint.startedBy,
          participants: Object.values(sprint.participants),
        },
      });
    } catch (err) {
      logger.error(err, `Error while handling sprintEnd event`);
    }
  },
};
