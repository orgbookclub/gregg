import { Colors, EmbedBuilder } from "discord.js";

import { CommandHandler } from "../../../models";
import { logger } from "../../../utils/logHandler";

/**
 * Generates an embed containing information about Gregg.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleAbout: CommandHandler = async (bot, interaction) => {
  try {
    const aboutEmbed = new EmbedBuilder()
      .setTitle(bot.user?.username ?? "Gregg")
      .setDescription(
        "Hi! I'm Gregg, a feature-rich Discord bot made for book clubs.",
      )
      .setColor(Colors.Gold)
      .setFooter({ text: `v${process.env.npm_package_version}` })
      .setThumbnail(bot.user?.displayAvatarURL() ?? null);
    await interaction.reply({ embeds: [aboutEmbed] });
  } catch (err) {
    logger.error(err, `Error in handleAbout`);
    await interaction.reply("Something went wrong! Please try again later.");
  }
};
