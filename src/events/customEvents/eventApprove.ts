import { EventDtoStatusEnum } from "@orgbookclub/ows-client";

import { Bot } from "../../interfaces/Bot";
import { Event } from "../../interfaces/Event";
import { logger } from "../../utils/logHandler";

interface EventApproveDto {
  id: string;
}

export const eventApprove: Event = {
  name: "eventApprove",
  run: async (bot: Bot, eventApproveDto: EventApproveDto) => {
    try {
      // Update event status to Approved
      logger.debug(`eventApprove event fired: ${eventApproveDto}`);
      const response = await bot.api.events.eventsControllerUpdate({
        id: eventApproveDto.id,
        updateEventDto: { status: EventDtoStatusEnum.Approved },
      });
      const event = response.data;
      logger.debug(`event updated: ${JSON.stringify(event)}`);
    } catch (err) {
      logger.error(`Error while handling eventApprove event ${err}`);
    }
  },
};
