import { Message } from "discord.js";

import { Bot } from "../models";

/**
 * Gets the guild config from the database.
 *
 * @param bot The bot instance.
 * @param guildId The guild id.
 * @returns The guild config doc.
 */
export async function getGuildConfigFromDb(bot: Bot, guildId: string) {
  const guild = await bot.db.guilds.findUnique({
    select: { config: true },
    where: { guildId: guildId },
  });
  return guild?.config;
}

/**
 * Gets the guilds configs from the database.
 *
 * @param bot The bot instance.
 * @returns A list of objects with guildIds and configs.
 */
export async function getAllGuildConfigs(bot: Bot) {
  const guilds = await bot.db.guilds.findMany({
    select: { guildId: true, config: true },
  });
  return guilds;
}

/**
 * Creates an event message doc in the db.
 *
 * @param bot The bot.
 * @param guildId The guild ID.
 * @param eventId The event ID.
 * @param message The message.
 * @param type The type of the event message.
 */
export async function createEventMessageDoc(
  bot: Bot,
  guildId: string,
  eventId: string,
  message: Message,
  type: string,
) {
  await bot.db.eventMessages.create({
    data: {
      guildId: guildId,
      eventId: eventId,
      channelId: message.channel.id,
      messageId: message.id,
      messageUrl: message.url,
      type: type,
      createdOn: message.createdAt,
      updatedOn: message.createdAt,
    },
  });
}
