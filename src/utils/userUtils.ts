import { User } from "discord.js";

import { Bot } from "../models";

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
        profile: {
          bio: "",
        },
      },
    });
    userDoc = userCreateResponse.data;
  }
  return userDoc;
}
