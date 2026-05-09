import { EventDocument, EventDtoStatusEnum } from "@orgbookclub/ows-client";
import { GuildsConfig } from "@prisma/client";
import {
  ButtonInteraction,
  ChannelSelectMenuBuilder,
  ChannelType,
  ChatInputCommandInteraction,
  Colors,
  DiscordjsError,
  EmbedBuilder,
  GuildMember,
  LabelBuilder,
  Message,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextChannel,
  TextDisplayBuilder,
  channelMention,
  roleMention,
} from "discord.js";

import { errors } from "../../../config/constants";
import { Bot, CommandHandler } from "../../../models";
import { createEventMessageDoc } from "../../../utils/dbUtils";
import { errorHandler } from "../../../utils/errorHandler";
import { getEventAnnouncementEmbed } from "../../../utils/eventUtils";
import { logToWebhook, logger } from "../../../utils/logHandler";
import { getButtonActionRow } from "../../../utils/messageUtils";
import { hasRole } from "../../../utils/userUtils";

/**
 * Announces an approved event.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 * @param guildConfig The guild config.
 */
// TODO: switch slash command to also use showAnnounceModalAndPost for UX consistency with the Announce button.
const handleAnnounce: CommandHandler = async (
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
    if (!interaction.guild) {
      await interaction.reply("You can't use this outside a guild!");
      return;
    }

    await interaction.deferReply();
    const id = interaction.options.getString("id", true);
    const channel =
      interaction.options.getChannel<ChannelType.GuildAnnouncement>("channel");

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
        "Event must be in 'Approved' state! Announcements can only be created for Approved events",
      );
      return;
    }

    const announcementResult = await announceEventForGuild(
      bot,
      eventDoc,
      guildConfig as GuildsConfig,
      interaction.guild.id,
      interaction,
      channel as TextChannel | null,
    );
    if (!announcementResult) {
      await interaction.editReply(
        "Configured announcement channel is not valid :(",
      );
      return;
    }
    const statusMessage = getAnnounceStatusMessage(
      announcementResult.statusUpdated,
      "slash",
    );
    await interaction.editReply({
      content: `Announcement posted for event ${eventDoc._id}: ${announcementResult.message.url} ${statusMessage}`,
    });
  } catch (err) {
    await interaction.reply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > events > announce",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

async function addAnnouncementLinkInThread(
  bot: Bot,
  eventDoc: EventDocument,
  announcementMessage: Message,
  webhookUrl: string,
) {
  const starterMessages = await bot.db.eventMessages.findMany({
    where: {
      eventId: eventDoc._id,
      type: "eventThreadStarterMessage",
    },
  });
  const messageUpdateEmbed = new EmbedBuilder()
    .setColor(Colors.Yellow)
    .setTitle("Message Update")
    .setDescription(
      `Updated Event thread starter message with announcement link for \`${eventDoc._id}\``,
    )
    .setTimestamp();
  for (const doc of starterMessages) {
    try {
      const threadChannel = (await bot.channels.fetch(
        doc.channelId,
      )) as TextChannel;
      const message = await threadChannel.messages.fetch(doc.messageId);
      const updatedMessageContent =
        message.content + `\n**Announcement**: ${announcementMessage.url}`;
      await message.edit({
        components: message.components,
        embeds: message.embeds,
        content: updatedMessageContent,
      });
      await logToWebhook({ embeds: [messageUpdateEmbed] }, webhookUrl);
    } catch (error) {
      logger.error(
        error,
        `Unable to update message ${doc.messageId} in channel ${doc.channelId}`,
      );
    }
  }
}

function getAnnouncementString(
  pingRole: string,
  eventDoc: EventDocument,
): string | undefined {
  return (
    `${roleMention(pingRole)} New ${
      eventDoc.type
    }! Please click on the Join ✅ button if you'd like to be pinged for discussions.` +
    "\n" +
    `Discussion will take place in ${eventDoc.threads
      .map((x) => channelMention(x))
      .join(", ")}`
  );
}

function getAnnounceStatusMessage(
  statusUpdated: boolean,
  context: "slash" | "modal",
) {
  if (context === "slash") {
    return statusUpdated
      ? "and event status changed to 'Announced'"
      : "but event status could not be updated to 'Announced'";
  }
  return statusUpdated
    ? "Event status updated to **Announced**."
    : "However, the event status could not be updated to **Announced**.";
}

/**
 * Announces an Approved event using the existing announcement embed +
 * Join/Leave button row, marks the event as Announced, and links the
 * announcement back into the event thread(s). Used by both the slash
 * command and the Announce button on the event info card.
 *
 * @param bot The bot instance.
 * @param eventDoc The event (must be Approved).
 * @param guildConfig The guild config.
 * @param guildId The guild id.
 * @param interaction The interaction (used by the announcement embed builder).
 * @param channelOverride Optional channel to post in instead of the configured one.
 * @returns The posted announcement message, or null if the channel is misconfigured.
 */
async function announceEventForGuild(
  bot: Bot,
  eventDoc: EventDocument,
  guildConfig: GuildsConfig,
  guildId: string,
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  channelOverride?: TextChannel | null,
): Promise<{ message: Message; statusUpdated: boolean } | null> {
  let announcementChannel = channelOverride ?? null;
  if (!announcementChannel) {
    const channelId = guildConfig?.eventAnnouncementChannel ?? "Not set";
    const configuredChannel = await bot.channels.fetch(channelId);
    if (
      !configuredChannel ||
      configuredChannel.type !== ChannelType.GuildAnnouncement
    ) {
      return null;
    }
    announcementChannel = configuredChannel as unknown as TextChannel;
  }
  const pingRole = guildConfig?.serverEventsRole ?? "Not set";
  const announcementMessage = await announcementChannel.send({
    content: getAnnouncementString(pingRole, eventDoc),
    embeds: [getEventAnnouncementEmbed(eventDoc, interaction)],
    components: [getButtonActionRow(eventDoc._id, "ea")],
  });
  await createEventMessageDoc(
    bot,
    guildId,
    eventDoc._id,
    announcementMessage,
    "Announcement",
  );
  let statusUpdated = true;
  try {
    await bot.api.events.eventsControllerUpdate({
      id: eventDoc._id,
      updateEventDto: { status: EventDtoStatusEnum.Announced },
    });
  } catch (error) {
    statusUpdated = false;
    logger.warn(
      error,
      `Failed to update event status to Announced for event ${eventDoc._id}`,
    );
  }
  await addAnnouncementLinkInThread(
    bot,
    eventDoc,
    announcementMessage,
    guildConfig.logWebhookUrl,
  );
  return { message: announcementMessage, statusUpdated };
}

const ANNOUNCE_MODAL_ID = "eventAnnounceModal";
const ANNOUNCE_CHANNEL_FIELD_ID = "channel";
const ANNOUNCE_MODAL_TIMEOUT_MS = 5 * 60 * 1000;

function buildAnnounceModal(
  customId: string,
  eventDoc: EventDocument,
  defaultChannelId: string | null,
) {
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(ANNOUNCE_CHANNEL_FIELD_ID)
    .setChannelTypes(ChannelType.GuildAnnouncement)
    .setMinValues(1)
    .setMaxValues(1);
  if (defaultChannelId) {
    channelSelect.setDefaultChannels(defaultChannelId);
  }

  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle("Announce Event")
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Event ID:** \`${eventDoc._id}\``),
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Announcement channel")
        .setChannelSelectMenuComponent(channelSelect),
    );
}

/**
 * Opens the announce confirmation modal pre-filled with the configured
 * announcement channel, then calls `announceEventForGuild` on submit.
 * Caller is responsible for the staff role check, `Approved` status check,
 * and ensuring the event has at least one thread.
 *
 * @param bot The bot instance.
 * @param interaction The button interaction that triggered the modal.
 * @param eventDoc The event.
 * @param guildConfig The guild config.
 */
async function showAnnounceModalAndPost(
  bot: Bot,
  interaction: ButtonInteraction,
  eventDoc: EventDocument,
  guildConfig: GuildsConfig,
) {
  const defaultChannelId = guildConfig.eventAnnouncementChannel ?? null;

  const salt = Math.floor(Math.random() * 1e6);
  const modalCustomId = ANNOUNCE_MODAL_ID + salt;
  await interaction.showModal(
    buildAnnounceModal(modalCustomId, eventDoc, defaultChannelId),
  );

  const filter = (i: ModalSubmitInteraction) => i.customId === modalCustomId;
  let submit: ModalSubmitInteraction;
  try {
    submit = await interaction.awaitModalSubmit({
      filter,
      time: ANNOUNCE_MODAL_TIMEOUT_MS,
    });
  } catch (err) {
    if (err instanceof DiscordjsError) return;
    throw err;
  }

  await submit.deferReply({ flags: MessageFlags.Ephemeral });

  const selectedChannel = submit.fields
    .getSelectedChannels(ANNOUNCE_CHANNEL_FIELD_ID, false)
    ?.first();
  if (
    !selectedChannel ||
    selectedChannel.type !== ChannelType.GuildAnnouncement
  ) {
    await submit.editReply(
      "Selected channel is not a valid announcement channel.",
    );
    return;
  }
  if (!interaction.guildId) {
    await submit.editReply(errors.GuildOnlyActionError);
    return;
  }

  const announcementResult = await announceEventForGuild(
    bot,
    eventDoc,
    guildConfig,
    interaction.guildId,
    interaction,
    selectedChannel as unknown as TextChannel,
  );
  if (!announcementResult) {
    await submit.editReply("Could not post in the selected channel :(");
    return;
  }
  const statusMessage = getAnnounceStatusMessage(
    announcementResult.statusUpdated,
    "modal",
  );
  await submit.editReply(
    `Announcement posted: ${announcementResult.message.url}. ${statusMessage}`,
  );
}

export { handleAnnounce, announceEventForGuild, showAnnounceModalAndPost };
