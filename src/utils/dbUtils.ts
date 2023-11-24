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
