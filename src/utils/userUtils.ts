import { GuildMember } from "discord.js";

import { OWSClient } from "../providers/owsClient";

import { logger } from "./logHandler";

/**
 * Checks if a Guild Member has a certain role or not.
 *
 * @param member The guild member.
 * @param roleId The Role id.
 * @returns True if member has role, false otherwise.
 */
export function hasRole(member: GuildMember, roleId: string) {
  if (!member || !roleId) return false;
  return member.roles.cache.some((role) => role.id === roleId);
}

/**
 * Gets the user object from the server.
 * If user does not exist, creates one with default values.
 *
 * @param api The OWS client.
 * @param userId The user id.
 * @param username The username.
 * @returns The User document.
 */
export async function upsertUser(
  api: OWSClient,
  userId: string,
  username: string,
) {
  const response = await api.users.usersControllerFindOneByUserId({
    userid: userId,
  });
  let userDoc = response.data;
  if (!userDoc) {
    logger.debug(`Creating new user ${userId}`);
    const userCreateResponse = await api.users.usersControllerCreate({
      createUserDto: {
        userId: userId,
        name: username,
        joinDate: new Date().toISOString(),
        profile: { bio: "" },
      },
    });
    userDoc = userCreateResponse.data;
  }
  return userDoc;
}
