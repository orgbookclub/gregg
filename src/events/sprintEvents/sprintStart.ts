import Sprint from "../../classes/Sprint";
import { SprintStatus } from "../../classes/SprintStatus";
import { Bot } from "../../interfaces/Bot";
import { Event } from "../../interfaces/Event";
import { logger } from "../../utils/logHandler";

export const sprintStart: Event = {
  name: "sprintStart",
  // eslint-disable-next-line require-await
  run: async (bot: Bot, sprint: Sprint) => {
    try {
      logger.debug(
        `sprintStart event fired for sprint ${JSON.stringify(sprint)}`,
      );
      sprint.status = SprintStatus.Ongoing;
      sprint.timer = setTimeout(() => {
        bot.emit("sprintFinish", sprint);
      }, sprint.duration * 60 * 1000);
    } catch (err) {
      logger.error(`Error while handling sprintStart event: ${err}`);
    }
  },
};
