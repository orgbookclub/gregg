import { EventDocument, EventDtoStatusEnum } from "@orgbookclub/ows-client";
import {
  ChannelType,
  Colors,
  EmbedBuilder,
  GuildMember,
  Message,
  TextChannel,
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
        ephemeral: true,
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

    let announcementChannel = channel;
    if (!channel) {
      const channelId = guildConfig?.eventAnnouncementChannel ?? "Not set";
      const configuredChannel = await bot.channels.fetch(channelId);

      if (
        !configuredChannel ||
        configuredChannel.type !== ChannelType.GuildAnnouncement
      ) {
        await interaction.editReply(
          "Configured announcement channel is not valid :(",
        );
        return;
      }
      announcementChannel = configuredChannel;
    }
    if (!announcementChannel) return;
    const pingRole = guildConfig?.serverEventsRole ?? "Not set";
    const announcementMessage = await announcementChannel.send({
      content: getAnnouncementString(pingRole, eventDoc),
      embeds: [getEventAnnouncementEmbed(eventDoc, interaction)],
      components: [getButtonActionRow(eventDoc._id, "ea")],
    });

    await createEventMessageDoc(
      bot,
      interaction.guild.id,
      eventDoc._id,
      announcementMessage,
      "Announcement",
    );

    try {
      await bot.api.events.eventsControllerUpdate({
        id: eventDoc._id,
        updateEventDto: { status: EventDtoStatusEnum.Announced },
      });
      await interaction.editReply({
        content: `Announcement posted for event ${eventDoc._id}: ${announcementMessage.url} and event status changed to 'Announced'`,
      });
    } catch (_error) {
      await interaction.editReply(
        `Announcement posted for event ${eventDoc._id}: ${announcementMessage.url} but there was an error updating the event status :(`,
      );
    }
    // Also post the link to the announcement in the thread.
    if (!guildConfig) return;

    const webhookUrl = guildConfig.logWebhookUrl;
    await addAnnouncementLinkInThread(
      bot,
      eventDoc,
      announcementMessage,
      webhookUrl,
    );
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

export { handleAnnounce };
