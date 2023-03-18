import { UpdateEventDto } from "@orgbookclub/ows-client";

import { Bot } from "../../interfaces/Bot";
import { Event } from "../../interfaces/Event";
import { logger } from "../../utils/logHandler";

interface EventEditDto {
  id: string;
  updateEventDto: UpdateEventDto;
}

export const eventEdit: Event = {
  name: "eventEdit",
  run: async (bot: Bot, eventEditDto: EventEditDto) => {
    try {
      logger.debug(`eventEdit event fired: ${JSON.stringify(eventEditDto)}`);
      const response = await bot.api.events.eventsControllerUpdate(
        eventEditDto,
      );
      const event = response.data;
      logger.debug(`event updated: ${JSON.stringify(event)}`);
    } catch (err) {
      logger.error(`Error while handling eventEdit event ${err}`);
    }
  },
};
