import { UserDocument } from "@orgbookclub/ows-client";
import {
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  User,
} from "discord.js";

import { CommandHandler } from "../../../models";
import { logger } from "../../../utils/logHandler";

/**
 * Gets information about a user.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleInfo: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();
    const user = interaction.options.getUser("user") ?? interaction.user;
    const response = await bot.api.users.usersControllerFindOneByUserId({
      userid: user.id,
    });
    if (!response) {
      await interaction.editReply(
        `No user found! Please check if the user ID ${user.id} is registered with the bot`,
      );
      return;
    }
    const userDoc = response.data;
    const embed = getUserInfoEmbed(userDoc, user, interaction);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error(err, `Error in handleInfo`);
    await interaction.editReply(
      "Something went wrong! Please try again later.",
    );
  }
};

function getUserInfoEmbed(
  userDto: UserDocument,
  user: User,
  interaction: ChatInputCommandInteraction,
) {
  const embed = new EmbedBuilder()
    .setTitle(`${user.username}`)
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
