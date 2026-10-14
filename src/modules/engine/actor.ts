import { EngineActor } from "./types";

const ENGINE_ACTOR_PROVIDER = "discord";

/**
 * Structural view of a Discord guild member: either a cached `GuildMember`
 * (roles in `roles.cache`) or a raw API member (roles as an id array).
 */
type MemberLike =
  | { roles: string[] }
  | { roles: { cache: { keys(): Iterable<string> } } }
  | null
  | undefined;

function memberRoleIds(member: MemberLike, guildId?: string | null): string[] {
  if (!member) return [];
  const ids = Array.isArray(member.roles)
    ? member.roles
    : [...member.roles.cache.keys()];
  return ids.filter((id) => id !== guildId);
}

/**
 * Builds the engine actor for a Discord user. The `@everyone` role (whose id
 * equals the guild id) is dropped because it carries no mapping.
 *
 * @param input The Discord user, optional guild member and guild id.
 * @param input.user The Discord user.
 * @param input.user.id The Discord user id.
 * @param input.user.username The Discord username.
 * @param input.member The guild member, used for role ids.
 * @param input.guildId The guild id.
 * @returns The actor to assert.
 */
export function actorFromDiscord(input: {
  user: { id: string; username: string };
  member?: MemberLike;
  guildId?: string | null;
}): EngineActor {
  return {
    subject: input.user.id,
    name: input.user.username,
    roles: memberRoleIds(input.member, input.guildId),
  };
}

/**
 * Converts an actor into the `X-Actor-*` headers the engine expects. The name
 * is URL-encoded because HTTP header values must be ASCII.
 *
 * @param actor The actor.
 * @returns The headers.
 */
export function actorHeaders(actor: EngineActor): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Actor-Provider": ENGINE_ACTOR_PROVIDER,
    "X-Actor-Subject": actor.subject,
  };
  if (actor.name) headers["X-Actor-Name"] = encodeURIComponent(actor.name);
  if (actor.roles && actor.roles.length > 0) {
    headers["X-Actor-Roles"] = actor.roles.join(",");
  }
  return headers;
}

export { ENGINE_ACTOR_PROVIDER };
