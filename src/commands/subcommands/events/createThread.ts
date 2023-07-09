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

import { Bot, CommandHandler } from "../../../models";
import { getGuildFromDb } from "../../../utils/dbUtils";
import { errorHandler } from "../../../utils/errorHandler";
import {
  getEventInfoEmbed,
  getThreadTitle,
  getUserMentionString,
} from "../../../utils/eventUtils";

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
    const channel = interaction.options.getChannel<
      ChannelType.GuildForum | ChannelType.PublicThread
    >("channel");
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

    // Create a new thread in a forum
    if (!channel || channel.type === ChannelType.GuildForum) {
      let forum = channel;
      if (!channel) {
        forum = await getConfiguredForumChannel(
          bot,
          eventDoc.type,
          interaction.guild?.id,
        );
      }
      if (!forum) {
        await interaction.editReply(
          "Unable to find a configured/inputted forum channel!",
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
      return;
    }

    // Update an already existing thread
    if (!eventDoc.threads.includes(channel.id)) {
      const eventResponse = await bot.api.events.eventsControllerUpdate({
        id: eventDoc._id,
        updateEventDto: {
          threads: [...eventDoc.threads, channel.id],
        },
      });

      await channel.send({
        embeds: [getEventInfoEmbed(eventResponse.data, interaction)],
      });
    } else {
      await channel.send({
        embeds: [getEventInfoEmbed(eventDoc, interaction)],
      });
      if (threadTitle) {
        await channel.edit({ name: threadTitle });
      }
      await interaction.editReply(`Updated ${channelMention(channel.id)}`);
    }
  } catch (err) {
    await interaction.editReply("Something went wrong! Please try again later");
    await errorHandler(
      bot,
      "commands > events > createThread",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

async function getConfiguredForumChannel(
  bot: Bot,
  type: EventDocumentTypeEnum,
  guildId?: string,
) {
  let eventForum;
  if (!guildId) return null;
  const guildDoc = await getGuildFromDb(bot, guildId);
  if (type === EventDocumentTypeEnum.BuddyRead) {
    const channelId = guildDoc?.brForumChannel ?? "Not set";
    eventForum = await bot.channels.fetch(channelId);
  } else if (type === EventDocumentTypeEnum.MonthlyRead) {
    const channelId = guildDoc?.mrForumChannel ?? "Not set";
    eventForum = await bot.channels.fetch(channelId);
  }
  if (!eventForum || eventForum.type !== ChannelType.GuildForum) {
    return null;
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
