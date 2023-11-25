import { EventDocument, EventDtoStatusEnum } from "@orgbookclub/ows-client";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  GuildMember,
  channelMention,
  roleMention,
} from "discord.js";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { createEventMessageDoc } from "../../../utils/dbUtils";
import { errorHandler } from "../../../utils/errorHandler";
import { getEventInfoEmbed } from "../../../utils/eventUtils";
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
    } catch (error) {
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
    const message = await announcementChannel.send({
      content: getAnnouncementString(pingRole, eventDoc),
      embeds: [getEventInfoEmbed(eventDoc, interaction)],
      components: [getButtonActionRow(eventDoc._id)],
    });

    await createEventMessageDoc(
      bot,
      interaction.guild.id,
      eventDoc._id,
      message,
      "Announcement",
    );

    try {
      await bot.api.events.eventsControllerUpdate({
        id: eventDoc._id,
        updateEventDto: { status: EventDtoStatusEnum.Announced },
      });
      await interaction.editReply({
        content: `Announcement posted: ${message.url} and event status changed to 'Announced'`,
      });
    } catch (error) {
      await interaction.editReply(
        `Announcement posted: ${message.url} but there was an error updating the event status :(`,
      );
    }
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

function getButtonActionRow(eventId: string) {
  const interestedButton = new ButtonBuilder()
    .setLabel("Join")
    .setEmoji({ name: "✅" })
    .setStyle(ButtonStyle.Success)
    .setCustomId(`ea-${eventId}-interested`);
  const notInterestedButton = new ButtonBuilder()
    .setLabel("Leave")
    .setEmoji({ name: "⛔" })
    .setStyle(ButtonStyle.Danger)
    .setCustomId(`ea-${eventId}-notInterested`);
  const buttonActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    interestedButton,
    notInterestedButton,
  );
  return buttonActionRow;
}

export { handleAnnounce };
