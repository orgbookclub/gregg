import { EngineReaderTier, EngineTierAssignment } from "./types";

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * A role change needed to mirror engine tiers onto Discord roles.
 */
export interface TierRoleChange {
  memberId: string;
  roleId: string;
  tierId: string;
  action: "add" | "remove";
}

/**
 * A guild member as seen by the tier planner.
 */
export interface TierRoleMember {
  id: string;
  roleIds: Iterable<string>;
}

/**
 * Whether tier role sync is enabled for an installation. It is on unless a
 * club sets `publicSettings.syncTierRoles` to `false`.
 *
 * @param publicSettings The installation's public settings.
 * @returns True when enabled.
 */
export function isTierSyncEnabled(
  publicSettings: Record<string, unknown>,
): boolean {
  return publicSettings.syncTierRoles !== false;
}

/**
 * Resolves which Discord role mirrors each engine tier. An explicit
 * `publicSettings.tierRoles[tierId] = roleId` wins; otherwise a role whose
 * name matches the tier name (case-insensitive) is used. Roles that don't
 * exist in the guild are ignored.
 *
 * @param tiers The club's reader tiers.
 * @param guildRoles The guild's roles.
 * @param publicSettings The installation's public settings.
 * @returns A map of tier id to Discord role id.
 */
export function resolveTierRoleMap(
  tiers: EngineReaderTier[],
  guildRoles: { id: string; name: string }[],
  publicSettings: Record<string, unknown>,
): Map<string, string> {
  const explicit =
    publicSettings.tierRoles && typeof publicSettings.tierRoles === "object"
      ? (publicSettings.tierRoles as Record<string, unknown>)
      : {};
  const roleIds = new Set(guildRoles.map((role) => role.id));
  const byName = new Map<string, string>();
  for (const role of guildRoles) {
    const key = normalizeName(role.name);
    if (!byName.has(key)) byName.set(key, role.id);
  }
  const map = new Map<string, string>();
  for (const tier of tiers) {
    const configured = explicit[tier.id];
    if (typeof configured === "string" && roleIds.has(configured)) {
      map.set(tier.id, configured);
      continue;
    }
    const matched = byName.get(normalizeName(tier.name));
    if (matched) map.set(tier.id, matched);
  }
  return map;
}

/**
 * Plans the role additions and removals that make Discord roles match the
 * engine's tier assignments. Only guild members are touched. When the engine
 * reports no assignments at all, nothing is removed, so an outage or empty
 * response never strips every role holder.
 *
 * @param assignments The engine's tier assignments.
 * @param tierRoleMap The tier id to Discord role id map.
 * @param members The guild members with their role ids.
 * @returns The changes to apply.
 */
export function planTierRoleChanges(
  assignments: EngineTierAssignment[],
  tierRoleMap: Map<string, string>,
  members: TierRoleMember[],
): TierRoleChange[] {
  const holdersByTier = new Map<string, Set<string>>();
  for (const assignment of assignments) {
    const discordIds = assignment.identities
      .filter((identity) => identity.provider === "discord")
      .map((identity) => identity.subject);
    for (const tierId of assignment.tierIds) {
      const holders = holdersByTier.get(tierId) ?? new Set<string>();
      discordIds.forEach((id) => holders.add(id));
      holdersByTier.set(tierId, holders);
    }
  }
  const allowRemovals = assignments.length > 0;
  const roles = new Map<string, { tierId: string; holders: Set<string> }>();
  for (const [tierId, roleId] of tierRoleMap) {
    const entry = roles.get(roleId) ?? { tierId, holders: new Set<string>() };
    holdersByTier.get(tierId)?.forEach((id) => entry.holders.add(id));
    roles.set(roleId, entry);
  }
  const changes: TierRoleChange[] = [];
  for (const [roleId, { tierId, holders }] of roles) {
    for (const member of members) {
      const has = new Set(member.roleIds).has(roleId);
      const should = holders.has(member.id);
      if (should && !has) {
        changes.push({ memberId: member.id, roleId, tierId, action: "add" });
      } else if (!should && has && allowRemovals) {
        changes.push({ memberId: member.id, roleId, tierId, action: "remove" });
      }
    }
  }
  return changes;
}
