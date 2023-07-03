import { qotds } from "@prisma/client";
import {
  ChatInputCommandInteraction,
  TextChannel,
  ThreadAutoArchiveDuration,
} from "discord.js";

import { ChannelIds } from "../../../config";
import { Bot, CommandHandler } from "../../../models";
import { logger } from "../../../utils/logHandler";

/**
 * Posts a QOTD with the given ID, in the given channel.
 * If the ID is not given, selects a random QOTD to post.
 * If channel is not given, falls back to channel in Config.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handlePost: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const id = interaction.options.getString("id", false);
    let channel = interaction.options.getChannel("channel", false);
    let qotd: qotds | undefined = undefined;
    if (!id) {
      const allAvailableQotds = await bot.db.qotds.findMany({
        where: {
          status: "Approved",
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
      const channelId = ChannelIds.QotdChannel;
      const qotdChannel = await bot.channels.fetch(channelId);
      if (qotdChannel === null || !qotdChannel.isTextBased()) {
        throw new Error("Unable to post qotd in the configured channel");
      }
      channel = qotdChannel as TextChannel;
    }
    const textChannel = channel as TextChannel;
    const message = await textChannel.send({
      content: qotd.question,
    });
    await message.startThread({
      name: `QOTD: ${new Date().toDateString()}`,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
    });
    await bot.db.qotds.update({
      where: {
        id: qotd.id,
      },
      data: {
        status: "Posted",
      },
    });
    await interaction.editReply({
      content: `Qotd Posted for ${new Date().toDateString()}`,
    });
  } catch (err) {
    logger.error(err, "Error in handlePost");
  }
};

export { handlePost };
