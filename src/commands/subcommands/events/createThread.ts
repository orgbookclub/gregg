import {
  EventDocument,
  EventDocumentTypeEnum,
  EventDtoStatusEnum,
} from "@orgbookclub/ows-client";
import { GuildsConfig } from "@prisma/client";
import {
  channelMention,
  ChannelType,
  GuildMember,
  hideLinkEmbed,
  time,
  TimestampStyles,
} from "discord.js";

import { Bot, CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import {
  getEventInfoEmbed,
  getThreadTitle,
  getUserMentionString,
} from "../../../utils/eventUtils";
import { hasRole } from "../../../utils/userUtils";

/**
 * Creates thread(s) for an approved event, and writes information about the event on the thread.
 * If a thread is already provided, it will just write the information.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 * @param guildConfig The guild config.
 */
const handleCreateThread: CommandHandler = async (
  bot,
  interaction,
  guildConfig,
) => {
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
          guildConfig,
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
  guildConfig?: GuildsConfig,
) {
  let eventForum;
  if (!guildConfig) return null;
  if (type === EventDocumentTypeEnum.BuddyRead) {
    const channelId = guildConfig?.brForumChannel ?? "Not set";
    eventForum = await bot.channels.fetch(channelId);
  } else if (type === EventDocumentTypeEnum.MonthlyRead) {
    const channelId = guildConfig?.mrForumChannel ?? "Not set";
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
