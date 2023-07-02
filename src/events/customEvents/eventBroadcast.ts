import { TextChannel, userMention } from "discord.js";

import { Bot, Event } from "../../models";
import { logger } from "../../utils/logHandler";

interface EventBroadcastEventDto {
  id: string;
  content: string;
}

export const eventBroadcast: Event = {
  name: "eventBroadcast",
  run: async (bot: Bot, eventBroadcastEventDto: EventBroadcastEventDto) => {
    try {
      logger.debug(
        `eventBroadcast event fired: ${JSON.stringify(eventBroadcastEventDto)}`,
      );
      const response = await bot.api.events.eventsControllerFindOne({
        id: eventBroadcastEventDto.id,
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
        content: eventBroadcastEventDto.content,
      });
    } catch (err) {
      logger.error(err, `Error while handling eventBroadcast event`);
    }
  },
};
