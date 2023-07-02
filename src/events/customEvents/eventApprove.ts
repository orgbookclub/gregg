import { EventDtoStatusEnum } from "@orgbookclub/ows-client";

import { Bot, Event } from "../../models";
import { logger } from "../../utils/logHandler";

interface EventApproveEventDto {
  id: string;
}

/**
 * TODO: Remove this file. EventEdit should cover the business logic required here.
 */

export const eventApprove: Event = {
  name: "eventApprove",
  run: async (bot: Bot, eventApproveEventDto: EventApproveEventDto) => {
    try {
      // Update event status to Approved
      logger.debug(`eventApprove event fired: ${eventApproveEventDto}`);
      const response = await bot.api.events.eventsControllerUpdate({
        id: eventApproveEventDto.id,
        updateEventDto: { status: EventDtoStatusEnum.Approved },
      });
      const event = response.data;
      logger.debug(`event updated: ${JSON.stringify(event)}`);
    } catch (err) {
      logger.error(err, `Error while handling eventApprove event`);
    }
  },
};
