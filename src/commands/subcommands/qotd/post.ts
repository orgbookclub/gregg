import { qotds } from "@prisma/client";
import {
  ChannelType,
  GuildMember,
  TextChannel,
  ThreadAutoArchiveDuration,
  roleMention,
} from "discord.js";

import { CommandHandler } from "../../../models";
import { QotdSuggestionStatus } from "../../../models/commands/qotd/QotdSuggestionStatus";
import { errorHandler } from "../../../utils/errorHandler";
import { hasRole } from "../../../utils/userUtils";

/**
 * Posts a QOTD with the given ID, in the given channel.
 * If the ID is not given, selects a random QOTD to post.
 * If channel is not given, falls back to channel in Config.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 * @param guildConfig The guild config.
 */
const handlePost: CommandHandler = async (bot, interaction, guildConfig) => {
  try {
    if (
      guildConfig &&
      interaction.member &&
      !hasRole(interaction.member as GuildMember, guildConfig.staffRole)
    ) {
      await interaction.reply({
        content: "Sorry, this command is restricted for staff use only!",
        ephemeral: true,
      });
      return;
    }
    await interaction.deferReply();
    if (!interaction.guild) return;

    const id = interaction.options.getString("id", false);
    let channel =
      interaction.options.getChannel<ChannelType.GuildText>("channel");
    let qotd: qotds | undefined = undefined;
    if (!id) {
      const allAvailableQotds = await bot.db.qotds.findMany({
        where: {
          status: QotdSuggestionStatus.Approved,
        },
      });
      if (allAvailableQotds.length === 0) {
        await interaction.editReply("There are no available QOTDs to post!");
        return;
      }
      const randomQotd =
        allAvailableQotds[Math.floor(Math.random() * allAvailableQotds.length)];
      qotd = randomQotd;
    } else {
      const selectedQotd = await bot.db.qotds.findUnique({ where: { id: id } });
      if (!selectedQotd) {
        await interaction.editReply("No QOTD available with given ID!");
        return;
      }
      qotd = selectedQotd;
    }
    if (!channel) {
      const channelId = guildConfig?.qotdChannel ?? "Not set";
      const qotdChannel = await bot.channels.fetch(channelId);
      if (!qotdChannel?.isTextBased()) {
        throw new Error("Unable to post QOTD in the configured channel");
      }
      channel = qotdChannel as TextChannel;
    }
    const pingRole = guildConfig?.qotdPingRole ?? "Not set";
    const message = await channel.send(
      `${roleMention(pingRole)} ${qotd.question}`,
    );
    await message.startThread({
      name: `QOTD: ${new Date().toDateString()}`,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
    });
    await bot.db.qotds.update({
      where: { id: qotd.id },
      data: { status: QotdSuggestionStatus.Posted, updatedOn: new Date() },
    });
    await interaction.editReply({
      content: `QOTD Posted for ${new Date().toDateString()}`,
    });
  } catch (err) {
    await interaction.editReply("Something went wrong! Please try again later");
    await errorHandler(
      bot,
      "commands > qotd > post",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

export { handlePost };
