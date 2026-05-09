import { Bot } from "../models";

/**
 * Strips dynamic id segments (Mongo ObjectIds, Discord snowflakes) from a
 * customId so similar interactions collapse to a single counter row.
 *
 * @param customId The raw customId.
 */
export function normalizeCustomId(customId: string): string {
  return customId
    .split("-")
    .filter((seg) => !/^[0-9a-f]{24}$/i.test(seg) && !/^\d{16,21}$/.test(seg))
    .join("-");
}

/**
 * Upserts a usage counter row for a non-chat-input interaction.
 *
 * @param bot The bot instance.
 * @param type The interaction type (e.g. "button", "contextMenu").
 * @param identifier A stable identifier (normalized customId or command name).
 */
export async function upsertInteractionUsage(
  bot: Bot,
  type: string,
  identifier: string,
): Promise<void> {
  await bot.db.interactionUsages.upsert({
    where: {
      // eslint-disable-next-line camelcase
      type_identifier: { type, identifier },
    },
    update: {
      uses: { increment: 1 },
      updatedOn: new Date(),
    },
    create: {
      type,
      identifier,
      uses: 1,
      createdOn: new Date(),
      updatedOn: new Date(),
    },
  });
}
