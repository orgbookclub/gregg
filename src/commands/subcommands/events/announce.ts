import { EventDtoStatusEnum } from "@orgbookclub/ows-client";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  channelMention,
} from "discord.js";

import { CommandHandler } from "../../../models";
import { getGuildFromDb } from "../../../utils/dbUtils";
import { errorHandler } from "../../../utils/errorHandler";
import { getEventInfoEmbed } from "../../../utils/eventUtils";

/**
 * Announces an approved event.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleAnnounce: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();
    const id = interaction.options.getString("id", true);
    const channel =
      interaction.options.getChannel<ChannelType.GuildAnnouncement>("channel");

    const response = await bot.api.events.eventsControllerFindOne({ id: id });
    if (!response) {
      await interaction.editReply("Invalid Event ID!");
      return;
    }

    const eventDoc = response.data;
    if (eventDoc.status !== EventDtoStatusEnum.Approved) {
      await interaction.editReply(
        "Event must be in 'Approved' state! Announcements can only be created for approved events",
      );
      return;
    }
    let announcementChannel = channel;
    if (!channel) {
      if (!interaction.guild) return;
      const guildDoc = await getGuildFromDb(bot, interaction.guild.id);
      const channelId = guildDoc?.eventAnnouncementChannel ?? "Not set";
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

    const message = await announcementChannel.send({
      content:
        `New ${eventDoc.type}! Please click on the button if you'd like to be pinged for discussions.` +
        "\n" +
        `Discussion will take place in ${eventDoc.threads
          .map((x) => channelMention(x))
          .join(", ")}`,
      embeds: [getEventInfoEmbed(eventDoc, interaction)],
      components: [getButtonActionRow(eventDoc._id)],
    });
    await interaction.editReply(`Announcement posted: ${message.url}`);

    const updateResponse = await bot.api.events.eventsControllerUpdate({
      id: eventDoc._id,
      updateEventDto: { status: EventDtoStatusEnum.Announced },
    });
    if (!updateResponse) {
      await interaction.editReply(
        `Announcement posted: ${message.url} but There was an error updating the event status :(`,
      );
      return;
    }
    await interaction.editReply({
      content: `Announcement posted: ${message.url} and event status changed to 'Announced'`,
    });
  } catch (err) {
    await interaction.reply("Something went wrong! Please try again later");
    errorHandler(
      bot,
      "commands > events > announce",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

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
