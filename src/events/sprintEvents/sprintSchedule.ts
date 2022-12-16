import Sprint from "../../classes/Sprint";
import { Bot } from "../../interfaces/Bot";
import { Event } from "../../interfaces/Event";
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
      logger.error(`Error while handling sprintSchedule event ${err}`);
    }
  },
};
