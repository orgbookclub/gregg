import { ChannelType } from "discord.js";

import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * Sends an input message as the bot.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleEcho: CommandHandler = async (bot, interaction) => {
  try {
    const message = interaction.options.getString("message", true);
    const channel =
      interaction.options.getChannel<ChannelType.GuildText>("channel") ??
      interaction.channel;

    if (!channel?.isTextBased()) {
      await interaction.reply("Something went wrong!");
      return;
    }
    await channel.send({ content: message });
  } catch (err) {
    await interaction.reply("Something went wrong! Please try again later.");
    errorHandler(
      bot,
      "commands > gregg > echo",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
