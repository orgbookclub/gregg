import { GuildMember, User } from "discord.js";

import { Bot } from "../models";

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
 * @param bot The bot instance.
 * @param user The user.
 * @returns The User document.
 */
export async function upsertUser(bot: Bot, user: User) {
  const response = await bot.api.users.usersControllerFindOneByUserId({
    userid: user.id,
  });
  let userDoc = response.data;
  if (!userDoc) {
    const userCreateResponse = await bot.api.users.usersControllerCreate({
      createUserDto: {
        userId: user.id,
        name: user.username,
        joinDate: new Date().toISOString(),
        profile: { bio: "" },
      },
    });
    userDoc = userCreateResponse.data;
  }
  return userDoc;
}
