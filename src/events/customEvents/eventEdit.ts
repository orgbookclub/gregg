import { UpdateEventDto } from "@orgbookclub/ows-client";

import { Bot, Event } from "../../models";
import { logger } from "../../utils/logHandler";

interface EventEditEventDto {
  id: string;
  updateEventDto: UpdateEventDto;
}

export const eventEdit: Event = {
  name: "eventEdit",
  run: async (bot: Bot, eventEditDto: EventEditEventDto) => {
    try {
      logger.debug(`eventEdit event fired: ${JSON.stringify(eventEditDto)}`);
      const response = await bot.api.events.eventsControllerUpdate(
        eventEditDto,
      );
      const event = response.data;
      logger.debug(`event updated: ${JSON.stringify(event)}`);
    } catch (err) {
      logger.error(err, `Error while handling eventEdit event`);
    }
  },
};
