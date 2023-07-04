import { ButtonInteraction, ChatInputCommandInteraction } from "discord.js";

import { Bot } from "../models";

/**
 * Gets the user object from the server.
 * If user does not exist, creates one with default values.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 * @returns The User document.
 */
export async function upsertUser(
  bot: Bot,
  interaction: ButtonInteraction | ChatInputCommandInteraction,
) {
  const response = await bot.api.users.usersControllerFindOneByUserId({
    userid: interaction.user.id,
  });
  let user = response.data;
  if (!user) {
    const userCreateResponse = await bot.api.users.usersControllerCreate({
      createUserDto: {
        userId: interaction.user.id,
        name: interaction.user.username,
        joinDate: new Date().toISOString(),
        profile: {
          bio: "",
        },
      },
    });
    user = userCreateResponse.data;
  }
  return user;
}
