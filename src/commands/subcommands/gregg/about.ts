import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { logger } from "../../../utils/logHandler";

/**
 * Generates an embed containing information about Gregg.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
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
    logger.error(`Error in handlePing: ${err}`);
  }
};
