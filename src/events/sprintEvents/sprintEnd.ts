import Sprint from "../../classes/Sprint";
import { Bot } from "../../interfaces/Bot";
import { Event } from "../../interfaces/Event";
import { logger } from "../../utils/logHandler";

export const sprintEnd: Event = {
  name: "sprintEnd",
  // eslint-disable-next-line require-await
  run: async (bot: Bot, sprint: Sprint) => {
    try {
      logger.debug(
        `sprintEnd event fired for sprint ${JSON.stringify(sprint)}`,
      );
    } catch (err) {
      logger.error(`Error while handling sprintEnd event ${err}`);
    }
  },
};
