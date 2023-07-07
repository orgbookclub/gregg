import {
  EventDocument,
  EventDocumentTypeEnum,
  EventDtoStatusEnum,
} from "@orgbookclub/ows-client";
import {
  channelMention,
  ChannelType,
  hideLinkEmbed,
  time,
  TimestampStyles,
} from "discord.js";

import { ChannelIds } from "../../../config";
import { Bot, CommandHandler } from "../../../models";
import {
  getEventInfoEmbed,
  getThreadTitle,
  getUserMentionString,
} from "../../../utils/eventUtils";
import { logger } from "../../../utils/logHandler";

/**
 * Creates thread(s) for an approved event, and writes information about the event on the thread.
 * If a thread is already provided, it will just write the information.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleCreateThread: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();
    const id = interaction.options.getString("id", true);
    const thread =
      interaction.options.getChannel<ChannelType.PublicThread>("thread");
    const threadTitle = interaction.options.getString("title");

    // Validate event
    const response = await bot.api.events.eventsControllerFindOne({ id: id });
    if (!response) {
      await interaction.editReply("Invalid Event ID!");
    }
    const eventDoc = response.data;

    if (eventDoc.status !== EventDtoStatusEnum.Approved) {
      await interaction.editReply(
        "Event must be in 'Approved' state! Threads will only be created for approved events",
      );
      return;
    }

    if (!thread) {
      const forum = await getForumChannel(bot, eventDoc.type);
      if (!forum) {
        await interaction.editReply(
          "Unable to find a configured forum channel!",
        );
        return;
      }
      const post = await forum.threads.create({
        name: threadTitle ?? getThreadTitle(eventDoc),
        message: {
          content: getPostContent(eventDoc),
        },
      });
      await bot.api.events.eventsControllerUpdate({
        id: eventDoc._id,
        updateEventDto: {
          threads: [...eventDoc.threads, post.id],
        },
      });
      await interaction.editReply(`Created ${channelMention(post.id)}`);
    } else {
      if (!eventDoc.threads.includes(thread.id)) {
        const eventResponse = await bot.api.events.eventsControllerUpdate({
          id: eventDoc._id,
          updateEventDto: {
            threads: [...eventDoc.threads, thread.id],
          },
        });
        await thread.send({
          embeds: [getEventInfoEmbed(eventResponse.data, interaction)],
        });
      } else {
        await thread.send({
          embeds: [getEventInfoEmbed(eventDoc, interaction)],
        });
      }
      await interaction.editReply(`Updated ${channelMention(thread.id)}`);
    }
  } catch (err) {
    logger.error(err, `Error in handleCreateThread`);
    await interaction.editReply("Something went wrong! Please try again later");
  }
};

async function getForumChannel(bot: Bot, type: EventDocumentTypeEnum) {
  let eventForum;
  if (type === EventDocumentTypeEnum.BuddyRead) {
    eventForum = await bot.channels.fetch(ChannelIds.BRForumChannel);
  } else if (type === EventDocumentTypeEnum.MonthlyRead) {
    eventForum = await bot.channels.fetch(ChannelIds.MRForumChannel);
  }
  if (!eventForum || eventForum.type !== ChannelType.GuildForum) {
    return undefined;
  }
  return eventForum;
}

function getPostContent(event: EventDocument) {
  let content = "";

  content += `### From ${time(
    new Date(event.dates.startDate),
    TimestampStyles.LongDate,
  )} to ${time(new Date(event.dates.endDate), TimestampStyles.LongDate)}`;
  if (event.leaders.length > 0) {
    content += ` | Leader(s): ${getUserMentionString(event.leaders, false)}`;
  }
  content += `\n**Link**: ${hideLinkEmbed(event.book.url)}`;
  content += `\n**Cover**: ${event.book.coverUrl}`;
  content += `\n\n**ID**: \`${event._id}\``;
  return content;
}

export { handleCreateThread };
