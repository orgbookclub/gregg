import { qotds } from "@prisma/client";
import {
  ChannelType,
  TextChannel,
  ThreadAutoArchiveDuration,
} from "discord.js";

import { CommandHandler } from "../../../models";
import { QotdSuggestionStatus } from "../../../models/commands/qotd/QotdSuggestionStatus";
import { getGuildFromDb } from "../../../utils/dbUtils";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * Posts a QOTD with the given ID, in the given channel.
 * If the ID is not given, selects a random QOTD to post.
 * If channel is not given, falls back to channel in Config.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handlePost: CommandHandler = async (bot, interaction) => {
  try {
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
      const guildDoc = await getGuildFromDb(bot, interaction.guild.id);
      const channelId = guildDoc?.qotdChannel ?? "Not set";
      const qotdChannel = await bot.channels.fetch(channelId);
      if (!qotdChannel?.isTextBased()) {
        throw new Error("Unable to post QOTD in the configured channel");
      }
      channel = qotdChannel as TextChannel;
    }
    const message = await channel.send(qotd.question);
    await message.startThread({
      name: `QOTD: ${new Date().toDateString()}`,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
    });
    await bot.db.qotds.update({
      where: { id: qotd.id },
      data: { status: QotdSuggestionStatus.Posted },
    });
    await interaction.editReply({
      content: `QOTD Posted for ${new Date().toDateString()}`,
    });
  } catch (err) {
    await interaction.editReply("Something went wrong! Please try again later");
    errorHandler(
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
