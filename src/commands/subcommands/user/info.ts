import { EmbedBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction, User } from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { UserDto } from "../../../providers/ows/dto/user.dto";
import { logger } from "../../../utils/logHandler";

function getUserInfoEmbed(userDto: UserDto, user: User): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(user.username)
    .setThumbnail(user.displayAvatarURL() ?? user.defaultAvatarURL)
    .setFooter({ text: `User ID: ${userDto._id}` });
  return embed;
}

/**
 *
 * @param bot
 * @param interaction
 */
export const handleInfo: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    await interaction.deferReply();
    const user = interaction.options.getUser("user") ?? interaction.user;
    logger.debug(user.id);
    const userDto = await bot.apiClient.getUser(user.id);
    logger.debug(JSON.stringify(userDto));
    const embed = getUserInfoEmbed(userDto, user);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error(`Error in handleInfo ${err}`);
  }
};
