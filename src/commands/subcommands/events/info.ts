import {
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  userMention,
} from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { EventDto } from "../../../providers/ows/dto/event.dto";
import { getAuthorString } from "../../../utils/bookUtils";
import {
  getUnixTimestamp,
  getUserMentionString,
} from "../../../utils/eventUtils";
import { logger } from "../../../utils/logHandler";

function getEventInfoEmbed(
  data: EventDto,
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) {
  const embed = new EmbedBuilder()
    .setTitle(`${data.book.title} - ${getAuthorString(data.book.authors)}`)
    .setURL(data.book.url)
    .setFooter({ text: `Event ${data._id} fetched by ${bot.user?.username}` })
    .setColor(Colors.Gold)
    .setAuthor({
      name: data.type,
      iconURL: interaction.guild?.iconURL() ?? undefined,
    });
  if (data.description) {
    embed.addFields({
      name: "Description",
      value: data.description,
      inline: false,
    });
  }
  embed.addFields({
    name: "Start Date",
    value: `<t:${getUnixTimestamp(data.dates.startDate)}:D>`,
    inline: true,
  });
  embed.addFields({
    name: "End Date",
    value: `<t:${getUnixTimestamp(data.dates.endDate)}:D>`,
    inline: true,
  });
  if (data.threads !== null && data.threads.length > 0) {
    embed.addFields({
      name: "Thread",
      value: `<#${data.threads[0]}>`,
      inline: true,
    });
  }
  embed.addFields({
    name: "Requested By",
    value: `${userMention(data.requestedBy.user.userId)}`,
    inline: false,
  });
  if (data.leaders !== null && data.leaders.length > 0) {
    embed.addFields({
      name: "Leader(s)",
      value: getUserMentionString(data.leaders, true),
      inline: true,
    });
  }
  if (data.interested !== null && data.interested.length > 0) {
    embed.addFields({
      name: "Interested",
      value: getUserMentionString(data.interested, false),
      inline: false,
    });
  }
  if (data.readers !== null && data.readers.length > 0) {
    embed.addFields({
      name: "Reader(s)",
      value: getUserMentionString(data.readers, true),
      inline: false,
    });
  }
  return embed;
}

/**
 * Shows detailed information for an event.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleInfo: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const id = interaction.options.getString("id", true);
    const data = await bot.apiClient.getEventInfo(id);
    const embed = getEventInfoEmbed(data, bot, interaction);
    await interaction.editReply({
      embeds: [embed],
    });
  } catch (err) {
    logger.error(`Error in handleInfo: ${err}`);
  }
};
