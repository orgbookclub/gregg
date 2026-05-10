import { UserDocument } from "@orgbookclub/ows-client";
import {
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  User,
} from "discord.js";

import { errors, templates } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";

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
      await interaction.editReply(templates.noRegisteredUser(user.id));
      return;
    }
    const userDoc = response.data;
    const embed = getUserInfoEmbed(userDoc, user, interaction);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > user > info",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
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
