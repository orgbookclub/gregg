import {
  ChannelType,
  Colors,
  EmbedBuilder,
  channelMention,
  userMention,
} from "discord.js";

import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import { logToWebhook } from "../../../utils/logHandler";

/**
 * Sends an input message as the bot.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 * @param guildConfig The guildconfig.
 */
export const handleEcho: CommandHandler = async (
  bot,
  interaction,
  guildConfig,
) => {
  try {
    const message = interaction.options.getString("message", true);
    const channel =
      interaction.options.getChannel<ChannelType.GuildText>("channel") ??
      interaction.channel;

    if (!channel?.isTextBased() || channel.isDMBased()) {
      await interaction.reply("Something went wrong!");
      return;
    }
    await channel.send({ content: message });
    await interaction.reply({ content: "Echo successful!", ephemeral: true });
    if (guildConfig) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTimestamp()
        .setTitle("Echo")
        .setDescription(
          `${userMention(
            interaction.user.id,
          )} used echo in channel ${channelMention(
            channel.id,
          )} for message:\n ${message}`,
        );
      await logToWebhook({ embeds: [embed] }, guildConfig.logWebhookUrl);
    }
  } catch (err) {
    await interaction.reply("Something went wrong! Please try again later.");
    await errorHandler(
      bot,
      "commands > gregg > echo",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
