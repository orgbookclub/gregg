import { ChannelIds } from "../../config/ChannelIds";
import { Bot } from "../../interfaces/Bot";
import { Event } from "../../interfaces/Event";
import { CreateEventDto } from "../../providers/ows/dto/create-event.dto";
import { logger } from "../../utils/logHandler";

export const eventRequest: Event = {
  name: "eventRequest",
  run: async (bot: Bot, createEventDto: CreateEventDto) => {
    try {
      logger.debug(
        `eventRequest event fired: ${JSON.stringify(createEventDto)}`,
      );
      const createdEvent = await bot.apiClient.createEvent(createEventDto);
      const event = await bot.apiClient.getEventInfo(createdEvent._id);
      const channelId = ChannelIds.BRRequestChannel;
      // const 
      // create backend request
      // create embed in channel
      // send DM to event leader with guidelines
    } catch (err) {
      logger.error(`Error while handling eventRequest event ${err}`);
    }
  },
};
