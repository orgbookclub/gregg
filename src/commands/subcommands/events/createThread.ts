import {
  EventDocument,
  EventDocumentTypeEnum,
  EventDtoStatusEnum,
} from "@orgbookclub/ows-client";
import { GuildsConfig } from "@prisma/client";
import {
  ButtonInteraction,
  channelMention,
  ChannelSelectMenuBuilder,
  ChannelType,
  DiscordjsError,
  ForumChannel,
  GuildMember,
  hideLinkEmbed,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  time,
  TimestampStyles,
} from "discord.js";

import { errors } from "../../../config/constants";
import { Bot, CommandHandler } from "../../../models";
import { createEventMessageDoc } from "../../../utils/dbUtils";
import { errorHandler } from "../../../utils/errorHandler";
import {
  getEventInfoEmbed,
  getBookTitleWithAuthors,
} from "../../../utils/eventUtils";
import { getUserMentionString, hasRole } from "../../../utils/userUtils";

/**
 * Creates thread(s) for an approved event, and writes information about the event on the thread.
 * If a thread is already provided, it will just write the information.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 * @param guildConfig The guild config.
 */
// TODO: switch slash command to also use showCreateThreadModalAndCreate for UX consistency with the Create Thread button.
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
        content: errors.StaffRestrictionError,
        flags: MessageFlags.Ephemeral,
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
    let eventDoc: EventDocument;
    try {
      const response = await bot.api.events.eventsControllerFindOne({ id: id });
      eventDoc = response.data;
    } catch (_error) {
      await interaction.editReply(errors.InvalidEventIdError);
      return;
    }

    if (eventDoc.status !== EventDtoStatusEnum.Approved) {
      await interaction.editReply(
        "Event must be in 'Approved' state! Threads will only be created for approved events",
      );
      return;
    }

    // Create a new thread in a forum
    if (!channel || channel.type === ChannelType.GuildForum) {
      const threadId = await createForumThreadForEvent(
        bot,
        eventDoc,
        guildConfig as GuildsConfig,
        interaction.guild?.id ?? "",
        channel,
        threadTitle,
      );
      if (!threadId) {
        await interaction.editReply(
          "Unable to find a configured/inputted forum channel!",
        );
        return;
      }
      await interaction.editReply(
        `Created ${channelMention(threadId)} for event ${eventDoc._id}`,
      );
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
      await interaction.editReply(
        `Updated ${channelMention(channel.id)} for event ${eventDoc._id}`,
      );
    }
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
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
  content += `\n**[Book Link](${hideLinkEmbed(event.book.url)})**`;
  content += `\n**Cover**: ${event.book.coverUrl}`;
  content += `\n\n**ID**: \`${event._id}\``;
  return content;
}

/**
 * Creates a new forum post for an Approved event. Uses the configured forum
 * for its type unless `forumOverride` is given, and the book title unless
 * `threadTitle` is given. Updates the event with the new thread id and pins
 * the starter message.
 *
 * @param bot The bot instance.
 * @param eventDoc The event (must be Approved).
 * @param guildConfig The guild config.
 * @param guildId The guild id.
 * @param forumOverride Optional explicit forum to post in.
 * @param threadTitle Optional thread title override.
 * @returns The new thread id, or null if no configured forum was found.
 */
async function createForumThreadForEvent(
  bot: Bot,
  eventDoc: EventDocument,
  guildConfig: GuildsConfig,
  guildId: string,
  forumOverride?: ForumChannel | null,
  threadTitle?: string | null,
): Promise<string | null> {
  const forum =
    forumOverride ??
    (await getConfiguredForumChannel(bot, eventDoc.type, guildConfig));
  if (!forum) return null;

  const ongoingTag = forum.availableTags.filter((x) => x.name === "ongoing");
  const post = await forum.threads.create({
    name: threadTitle ?? getBookTitleWithAuthors(eventDoc.book),
    message: { content: getPostContent(eventDoc) },
    appliedTags: ongoingTag.length !== 0 ? [ongoingTag[0].id] : [],
  });
  const starterMessage = await post.fetchStarterMessage();
  if (starterMessage) {
    await starterMessage.pin();
    await createEventMessageDoc(
      bot,
      guildId,
      eventDoc._id,
      starterMessage,
      "eventThreadStarterMessage",
    );
  }
  await bot.api.events.eventsControllerUpdate({
    id: eventDoc._id,
    updateEventDto: {
      threads: [...eventDoc.threads, post.id],
    },
  });
  return post.id;
}

const CREATE_THREAD_MODAL_ID = "eventCreateThreadModal";
const FORUM_FIELD_ID = "forum";
const TITLE_FIELD_ID = "title";
const CT_MODAL_TIMEOUT_MS = 5 * 60 * 1000;

function buildCreateThreadModal(
  customId: string,
  eventDoc: EventDocument,
  defaultForumId: string | null,
  defaultTitle: string,
) {
  const forumSelect = new ChannelSelectMenuBuilder()
    .setCustomId(FORUM_FIELD_ID)
    .setChannelTypes(ChannelType.GuildForum)
    .setMinValues(1)
    .setMaxValues(1);
  if (defaultForumId) {
    forumSelect.setDefaultChannels(defaultForumId);
  }

  const titleInput = new TextInputBuilder()
    .setCustomId(TITLE_FIELD_ID)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100)
    .setValue(defaultTitle);

  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle("Create Thread")
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Event ID:** \`${eventDoc._id}\``),
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Forum")
        .setChannelSelectMenuComponent(forumSelect),
      new LabelBuilder()
        .setLabel("Thread title")
        .setTextInputComponent(titleInput),
    );
}

/**
 * Opens the create-thread confirmation modal pre-filled with the configured
 * forum + book title, then calls `createForumThreadForEvent` on submit.
 * Caller is responsible for the staff role check and `Approved` status check.
 *
 * @param bot The bot instance.
 * @param interaction The button interaction that triggered the modal.
 * @param eventDoc The event.
 * @param guildConfig The guild config.
 */
async function showCreateThreadModalAndCreate(
  bot: Bot,
  interaction: ButtonInteraction,
  eventDoc: EventDocument,
  guildConfig: GuildsConfig,
) {
  const defaultForum = await getConfiguredForumChannel(
    bot,
    eventDoc.type,
    guildConfig,
  );
  const defaultTitle = getBookTitleWithAuthors(eventDoc.book);

  const salt = Math.floor(Math.random() * 1e6);
  const modalCustomId = CREATE_THREAD_MODAL_ID + salt;
  await interaction.showModal(
    buildCreateThreadModal(
      modalCustomId,
      eventDoc,
      defaultForum?.id ?? null,
      defaultTitle,
    ),
  );

  const filter = (i: ModalSubmitInteraction) => i.customId === modalCustomId;
  let submit: ModalSubmitInteraction;
  try {
    submit = await interaction.awaitModalSubmit({
      filter,
      time: CT_MODAL_TIMEOUT_MS,
    });
  } catch (err) {
    if (err instanceof DiscordjsError) return;
    throw err;
  }

  await submit.deferReply({ flags: MessageFlags.Ephemeral });

  const forumChannel = submit.fields
    .getSelectedChannels(FORUM_FIELD_ID, false)
    ?.first();
  const title = submit.fields.getTextInputValue(TITLE_FIELD_ID).trim();
  if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
    await submit.editReply("Selected channel is not a forum channel.");
    return;
  }
  if (!interaction.guildId) {
    await submit.editReply(errors.GuildOnlyActionError);
    return;
  }

  const threadId = await createForumThreadForEvent(
    bot,
    eventDoc,
    guildConfig,
    interaction.guildId,
    forumChannel as ForumChannel,
    title,
  );
  if (!threadId) {
    await submit.editReply("Could not create the thread.");
    return;
  }
  await submit.editReply(
    `Created ${channelMention(threadId)} for event \`${eventDoc._id}\`.`,
  );
}

export {
  handleCreateThread,
  createForumThreadForEvent,
  showCreateThreadModalAndCreate,
};
