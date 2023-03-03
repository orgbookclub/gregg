import { EmbedBuilder } from "@discordjs/builders";
import { UserDocument } from "@orgbookclub/ows-client";
import { ChatInputCommandInteraction, Colors, User } from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { logger } from "../../../utils/logHandler";

function getUserInfoEmbed(
  userDto: UserDocument,
  user: User,
  interaction: ChatInputCommandInteraction,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`${user.username}#${user.discriminator}`)
    .setAuthor({
      name: interaction.guild?.name ?? "Guild Name Unavailable",
      iconURL: interaction.guild?.iconURL() ?? undefined,
    })
    .setDescription(
      userDto.profile.bio ? userDto.profile.bio : "Description unavailable",
    )
    .setThumbnail(user.displayAvatarURL() ?? user.defaultAvatarURL)
    .setColor(Colors.Gold)
    .setFooter({ text: `User ID: ${userDto._id}` });
  return embed;
}

/**
 * Gets the user info and returns an embed.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleInfo: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    await interaction.deferReply();
    const user = interaction.options.getUser("user") ?? interaction.user;
    const response =
      await bot.api.users.usersControllerFindOneByUserId(user.id);
    const userDto = response.data;
    const embed = getUserInfoEmbed(userDto, user, interaction);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error(`Error in handleInfo ${err}`);
  }
};
