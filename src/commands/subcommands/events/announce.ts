import { EventDtoStatusEnum } from "@orgbookclub/ows-client";
import { ChannelType, ChatInputCommandInteraction } from "discord.js";

import { ChannelIds } from "../../../config/ChannelIds";
import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { getAuthorString } from "../../../utils/bookUtils";
import { logger } from "../../../utils/logHandler";

/**
 *
 * @param bot
 * @param interaction
 */
export const handleAnnounce: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    await interaction.deferReply();
    const id = interaction.options.getString("id", true);
    const threadId = interaction.options.getChannel("thread");
    if (threadId === null) {
      const eventForum = await bot.channels.fetch(ChannelIds.BRForumChannel);
      if (eventForum === null || eventForum.type !== ChannelType.GuildForum) {
        throw new Error("Unable to find specified BR forum channel");
      }
      const response = await bot.api.events.eventsControllerFindOne({ id: id });
      const eventDoc = response.data;
      if (eventDoc.status !== EventDtoStatusEnum.Approved) {
        await interaction.reply(
          "Event is not in 'Approved' state :(. Only approved events can be announced",
        );
      }
      let eventTitle = `${eventDoc.book.title} - ${getAuthorString(
        eventDoc.book.authors,
      )}`;
      if (eventTitle.length >= 100) {
        eventTitle = eventTitle.slice(0, 96) + "...";
      }
      // TODO: Don't create thread if it already exists
      eventForum.threads.create({
        name: eventTitle,
        message: {
          content: "Event content message goes here",
        },
        reason: "Creating thread for BR",
      });
    } else {
      const channel = await bot.channels.fetch(threadId.id);
      if (channel === null || !channel.isTextBased()) {
        await interaction.reply("Specified channel/thread is invalid!");
      }
    }
  } catch (err) {
    logger.error(`Error in handleAnnounce: ${err}`);
  }
};
