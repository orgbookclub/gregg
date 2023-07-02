import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";

import { CommandHandler, Bot } from "../../../models";
import { logger } from "../../../utils/logHandler";

/**
 * Generates an embed containing information about Gregg.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleAbout: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const aboutEmbed = new EmbedBuilder();
    aboutEmbed.setTitle(bot.user?.tag ?? "Gregg");
    aboutEmbed.setDescription(
      "Hi! I'm Gregg, a feature-rich Discord bot made for book clubs",
    );
    await interaction.reply({ embeds: [aboutEmbed] });
  } catch (err) {
    logger.error(err, `Error in handleAbout`);
  }
};
