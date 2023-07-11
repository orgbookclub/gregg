import { Bot } from "../models";

/**
 * Gets the guild object from the database.
 *
 * @param bot The bot instance.
 * @param guildId The guild id.
 * @returns The guild doc.
 */
export async function getGuildConfigFromDb(bot: Bot, guildId: string) {
  const guild = await bot.db.guilds.findUnique({
    select: { config: true },
    where: { guildId: guildId },
  });
  return guild?.config;
}
