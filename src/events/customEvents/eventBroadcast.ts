import { TextChannel, userMention } from "discord.js";

import { Bot } from "../../models/Bot";
import { Event } from "../../models/Event";
import { logger } from "../../utils/logHandler";

interface EventBroadcastDto {
  id: string;
  content: string;
}

export const eventBroadcast: Event = {
  name: "eventBroadcast",
  run: async (bot: Bot, eventBroadcastDto: EventBroadcastDto) => {
    try {
      logger.debug(
        `eventBroadcast event fired: ${JSON.stringify(eventBroadcastDto)}`,
      );
      const response = await bot.api.events.eventsControllerFindOne({
        id: eventBroadcastDto.id,
      });
      const eventDoc = response.data;
      let mentionString = "";
      eventDoc.readers.forEach((x) => {
        mentionString += userMention(x.user.userId);
        mentionString += " ";
      });
      const threadId = eventDoc.threads[0];
      const channel = await bot.channels.fetch(threadId);
      if (channel === null || !channel.isTextBased()) {
        throw new Error("Unable to post event request in given channel");
      }
      if (mentionString.length !== 0) {
        await (channel as TextChannel).send({ content: mentionString });
      }

      await (channel as TextChannel).send({
        content: eventBroadcastDto.content,
      });
    } catch (err) {
      logger.error(`Error while handling eventBroadcast event: ${err}`);
    }
  },
};
