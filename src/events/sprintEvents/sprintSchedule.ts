import { Bot, Event } from "../../models";
import { logger } from "../../utils/logHandler";

export const sprintSchedule: Event = {
  name: "sprintSchedule",
  // eslint-disable-next-line require-await
  run: async (bot: Bot, sprintId: string, delayBy: number) => {
    try {
      const sprint = bot.dataCache.sprintManager.getSprint(sprintId);
      logger.debug(
        `sprintSchedule event fired for ${sprintId}: ${JSON.stringify(sprint)}`,
      );
      sprint.timer = setTimeout(() => {
        bot.emit("sprintStart", sprintId);
      }, delayBy * 60 * 1000);
    } catch (err) {
      logger.error(err, `Error while handling sprintSchedule event`);
    }
  },
};
