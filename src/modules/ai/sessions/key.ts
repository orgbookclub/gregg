import { SessionKey } from "../types";

/**
 * Computes the in-memory cache key for a session. Sessions are scoped
 * per (guildId, channelId, userId) — channelId is the thread id when in
 * a thread, otherwise the channel id.
 *
 * @param key The session coordinates.
 * @returns A stable string key suitable for Map lookup.
 */
export function sessionCacheKey(key: SessionKey): string {
  return `${key.guildId}:${key.channelId}:${key.userId}`;
}
