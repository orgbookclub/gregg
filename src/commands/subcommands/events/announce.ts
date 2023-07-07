import { EventDtoStatusEnum } from "@orgbookclub/ows-client";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  channelMention,
  ChatInputCommandInteraction,
  TextChannel,
} from "discord.js";

import { ChannelIds } from "../../../config";
import { Bot, CommandHandler } from "../../../models";
import { getEventInfoEmbed } from "../../../utils/eventUtils";
import { logger } from "../../../utils/logHandler";

/**
 * Announces an approved event.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleAnnounce: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    await interaction.deferReply();
    const id = interaction.options.getString("id", true);

    // Validate event
    const response = await bot.api.events.eventsControllerFindOne({ id: id });
    if (!response) {
      await interaction.editReply("Invalid Event ID!");
    }

    const event = response.data;
    if (event.status !== EventDtoStatusEnum.Approved) {
      await interaction.editReply(
        "Event must be in 'Approved' state! Announcements can only be created for approved events.",
      );
      return;
    }

    const announcementChannel = await bot.channels.fetch(
      ChannelIds.EventAnnouncementChannel,
    );

    if (!announcementChannel?.isTextBased()) return;

    const message = await announcementChannel.send({
      content: `New Server Event! Please click on the button if you'd like to be pinged for discussions.\nDiscussion will take place in ${channelMention(
        event.threads[0],
      )}`,
      embeds: [getEventInfoEmbed(event, interaction)],
      components: [getButtonActionRow(event._id)],
    });

    await bot.api.events.eventsControllerUpdate({
      id: event._id,
      updateEventDto: { status: "Announced" },
    });
    await interaction.editReply(`Announcement posted: ${message.url}`);
  } catch (err) {
    logger.error(err, `Error in handleAnnounce`);
  }
};

function getButtonActionRow(eventId: string) {
  const interestedButton = new ButtonBuilder()
    .setEmoji({ name: "✅" })
    .setStyle(ButtonStyle.Success)
    .setCustomId(`ea-${eventId}-interested`);
  const notInterestedButton = new ButtonBuilder()
    .setEmoji({ name: "❌" })
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(`ea-${eventId}-notInterested`);
  const buttonActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    interestedButton,
    notInterestedButton,
  );
  return buttonActionRow;
}

export { handleAnnounce };
