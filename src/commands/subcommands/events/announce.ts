import { EventDtoStatusEnum } from "@orgbookclub/ows-client";
import {
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
export const handleAnnounce: CommandHandler = async (
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

    const announcementChannel = (await bot.channels.fetch(
      ChannelIds.EventAnnouncementChannel,
    )) as TextChannel;
    const message = await announcementChannel.send({
      content: `New Buddy Read! Please react with ✅ if you'd like to participate in the discussions.\nDiscussion will take place in ${channelMention(
        event.threads[0],
      )}`,
      embeds: [getEventInfoEmbed(event, bot, interaction)],
    });
    await message.react("✅");
    await bot.api.events.eventsControllerUpdate({
      id: event._id,
      updateEventDto: { status: "Announced" },
    });
    await interaction.editReply(`Announcement posted: ${message.url}`);
  } catch (err) {
    logger.error(err, `Error in handleAnnounce`);
  }
};
