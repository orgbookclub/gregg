import { ChannelType, Events, Message } from "discord.js";

import { Bot, Event } from "../../models";
import { errorHandler } from "../../utils/errorHandler";

const messageCreate: Event = {
  name: Events.MessageCreate,
  run: async (bot: Bot, message: Message) => {
    try {
      const { author, channel, guild } = message;
      if (author.bot || !guild || channel.type === ChannelType.DM) {
        return;
      }

      await upsertMessageCountInDb(bot, message);
    } catch (error) {
      await errorHandler(
        bot,
        `events > ${Events.MessageCreate}`,
        error,
        message.guild?.name,
        message,
      );
    }
  },
};

async function upsertMessageCountInDb(bot: Bot, message: Message) {
  const { author, channel, guild } = message;
  if (!guild) return;

  await bot.db.messageCounts.upsert({
    where: {
      // eslint-disable-next-line camelcase
      guildId_userId_channelId: {
        guildId: guild.id,
        userId: author.id,
        channelId: channel.id,
      },
    },
    update: {
      count: {
        increment: 1,
      },
      updatedOn: new Date(),
    },
    create: {
      guildId: guild.id,
      userId: author.id,
      channelId: channel.id,
      count: 1,
      createdOn: new Date(),
      updatedOn: new Date(),
    },
  });
}

export { messageCreate };
