import { Bot } from "../../models/Bot";
import { Event } from "../../models/Event";
import Sprint from "../../models/Sprint";
import { logger } from "../../utils/logHandler";

export const sprintSchedule: Event = {
  name: "sprintSchedule",
  // eslint-disable-next-line require-await
  run: async (bot: Bot, sprint: Sprint, delayBy: number) => {
    try {
      logger.debug(
        `sprintSchedule event fired for ${sprint.threadId}: ${JSON.stringify(
          sprint,
        )}`,
      );
      sprint.timer = setTimeout(() => {
        bot.emit("sprintStart", sprint);
      }, delayBy * 60 * 1000);
    } catch (err) {
      logger.error(err, `Error while handling sprintSchedule event`);
    }
  },
};
