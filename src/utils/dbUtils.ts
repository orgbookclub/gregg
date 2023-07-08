import { Bot } from "../models";

/**
 * Gets the guild object from the database.
 *
 * @param bot The bot instance.
 * @param guildId The guild id.
 * @returns The guild doc.
 */
export async function getGuildFromDb(bot: Bot, guildId: string) {
  return await bot.db.guilds.findUnique({
    where: { guildId: guildId },
  });
}
