import { ChannelType, Message } from "discord.js";

import { Bot, Event } from "../../models";
import { logger } from "../../utils/logHandler";

export const messageCreate: Event = {
  name: "messageCreate",
  // eslint-disable-next-line require-await
  run: async (bot: Bot, message: Message) => {
    try {
      const { author, channel, guild } = message;
      if (author.bot) {
        return;
      }

      if (!guild || channel.type === ChannelType.DM) {
        return;
      }

      // TODO: Load any custom listeners here

      logger.debug(
        `Guild ${guild.id}: ${author.tag}(${author.id}) sent message ${message.id}`,
      );
    } catch (err) {
      logger.error(err, `Error while handling messageCreate event`);
    }
  },
};
