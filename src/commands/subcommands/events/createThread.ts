import {
  EventDocument,
  EventDocumentTypeEnum,
  EventDtoStatusEnum,
} from "@orgbookclub/ows-client";
import {
  Channel,
  channelMention,
  ChannelType,
  ChatInputCommandInteraction,
  TextChannel,
} from "discord.js";

import { ChannelIds } from "../../../config";
import { Bot, CommandHandler } from "../../../models";
import { getAuthorString } from "../../../utils/bookUtils";
import {
  getEventInfoEmbed,
  getThreadTitle,
  getUnixTimestamp,
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
const handleCreateThread: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    await interaction.deferReply();
    const id = interaction.options.getString("id", true);
    const thread = interaction.options.getChannel("thread");

    // Validate event
    const response = await bot.api.events.eventsControllerFindOne({ id: id });
    if (!response) {
      await interaction.editReply("Invalid Event ID!");
    }
    const event = response.data;

    if (event.status !== EventDtoStatusEnum.Approved) {
      await interaction.editReply(
        "Event must be in 'Approved' state! Threads can only be created for approved events.",
      );
      return;
    }

    const title = getThreadTitle(event);
    if (thread === null) {
      const forum = await getForumChannel(bot, event.type);
      const post = await forum.threads.create({
        name: title,
        message: {
          content: getPostContent(event),
        },
        reason: "Creating new thread for event",
      });
      await bot.api.events.eventsControllerUpdate({
        id: event._id,
        updateEventDto: {
          threads: [...event.threads, post.id],
        },
      });
      await interaction.editReply(`Created ${channelMention(post.id)}`);
    } else {
      const textThread = thread as TextChannel;
      await textThread.send({
        embeds: [getEventInfoEmbed(event, bot, interaction)],
      });
      await bot.api.events.eventsControllerUpdate({
        id: event._id,
        updateEventDto: {
          threads: [...event.threads, thread.id],
        },
      });
      await interaction.editReply(`Updated ${channelMention(thread.id)}`);
    }
    return;
  } catch (err) {
    logger.error(err, `Error in handleCreateThread`);
  }
};

async function getForumChannel(bot: Bot, type: EventDocumentTypeEnum) {
  let eventForum: Channel | null = null;
  if (type === EventDocumentTypeEnum.BuddyRead) {
    eventForum = await bot.channels.fetch(ChannelIds.BRForumChannel);
  } else if (type === EventDocumentTypeEnum.MonthlyRead) {
    eventForum = await bot.channels.fetch(ChannelIds.MRForumChannel);
  }
  if (eventForum === null || eventForum.type !== ChannelType.GuildForum) {
    throw new Error(
      `Unable to find specified forum channel for event type: ${type}`,
    );
  }
  return eventForum;
}

function getPostContent(event: EventDocument) {
  let content = "";
  const eventTitle = `${event.book.title} - ${getAuthorString(
    event.book.authors,
  )}`;
  content += `# ${eventTitle}`;
  content += `\n### Link: ${event.book.url}`;
  content += `\n### Cover: ${event.book.coverUrl}`;
  content += `\n### Start Date: ${getUnixTimestamp(event.dates.startDate)}`;
  content += `\n### End Date: ${getUnixTimestamp(event.dates.endDate)}`;
  if (event.leaders.length > 0) {
    content += `\n\nLeader(s): ${getUserMentionString(event.leaders, false)}`;
  }
  content += `\n\n ID: \`${event._id}\``;
  return content;
}

export { handleCreateThread };
