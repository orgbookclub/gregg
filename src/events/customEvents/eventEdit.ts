import { UpdateEventDto } from "@orgbookclub/ows-client";
import { ButtonInteraction } from "discord.js";

import { Bot, Event } from "../../models";
import {
  getEventInfoEmbed,
  getEventRequestEmbed,
} from "../../utils/eventUtils";
import { logger } from "../../utils/logHandler";

interface EventEditEventDto {
  id: string;
  updateEventDto: UpdateEventDto;
  interaction?: ButtonInteraction;
  updateEmbedType?: string;
}

export const eventEdit: Event = {
  name: "eventEdit",
  run: async (bot: Bot, eventEditDto: EventEditEventDto) => {
    try {
      logger.debug(`eventEdit event fired for ${eventEditDto.id}`);
      const response = await bot.api.events.eventsControllerUpdate(
        eventEditDto,
      );
      const event = response.data;
      logger.debug(`event updated: ${JSON.stringify(event)}`);
      if (eventEditDto.interaction) {
        let updatedEmbed;
        if (eventEditDto.updateEmbedType === "er") {
          updatedEmbed = getEventRequestEmbed(event, eventEditDto.interaction);
        } else if (eventEditDto.updateEmbedType === "ea") {
          updatedEmbed = getEventInfoEmbed(event, eventEditDto.interaction);
        }
        if (!updatedEmbed) {
          return;
        }
        await eventEditDto.interaction.message.edit({
          embeds: [updatedEmbed],
        });
      }
    } catch (err) {
      logger.error(err, `Error while handling eventEdit event`);
    }
  },
};
