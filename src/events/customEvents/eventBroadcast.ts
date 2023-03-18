import { TextChannel, userMention } from "discord.js";

import { Bot } from "../../interfaces/Bot";
import { Event } from "../../interfaces/Event";
import { logger } from "../../utils/logHandler";

interface EventBroadcastDto {
  id: string;
  content: string;
}

export const eventBroadcast: Event = {
  name: "eventBroadcast",
  run: async (bot: Bot, eventBroadcastDto: EventBroadcastDto) => {
    try {
      logger.debug(`eventBroadcast event.fired: ${eventBroadcastDto}`);
      const response = await bot.api.events.eventsControllerFindOne({ id: id });
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
      await (channel as TextChannel).send({ content: mentionString });
      await (channel as TextChannel).send({
        content: eventBroadcastDto.content,
      });
    } catch (err) {
      logger.error(`Error while handling eventBroadcast event: ${err}`);
    }
  },
};
