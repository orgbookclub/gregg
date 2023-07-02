import { UserDocument } from "@orgbookclub/ows-client";
import {
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  User,
} from "discord.js";

import { CommandHandler, Bot } from "../../../models";
import { logger } from "../../../utils/logHandler";

/**
 * Gets the user info and returns an embed.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleInfo: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    await interaction.deferReply();
    const user = interaction.options.getUser("user") ?? interaction.user;
    const response = await bot.api.users.usersControllerFindOneByUserId({
      userid: user.id,
    });
    const userDto = response.data;
    const embed = getUserInfoEmbed(userDto, user, interaction);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error(err, `Error in handleInfo`);
  }
};

function getUserInfoEmbed(
  userDto: UserDocument,
  user: User,
  interaction: ChatInputCommandInteraction,
) {
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

export { handleInfo };
