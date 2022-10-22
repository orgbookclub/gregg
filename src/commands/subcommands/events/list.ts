import { ChatInputCommandInteraction, Colors, EmbedBuilder } from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { EventDto } from "../../../providers/ows/dto/event.dto";
import { getAuthorString } from "../../../utils/bookUtils";
import { logger } from "../../../utils/logHandler";
import { PaginationManager } from "../../../utils/paginationUtils";

function getEventsListEmbed(
  data: EventDto[],
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) {
  const embed = new EmbedBuilder()
    .setTitle("Events")
    .setFooter({ text: `Fetched by ${bot.user?.username}` })
    .setColor(Colors.Red);
  if (interaction.inGuild()) {
    embed.setAuthor({
      name: interaction.guild?.name ?? "Unknown Guild",
      iconURL: interaction.guild?.iconURL() ?? undefined,
    });
  }
  data.forEach((event: EventDto) => {
    embed.addFields({
      name: `📕 ${event.book.title} - ${getAuthorString(event.book.authors)}`,
      value: `> [Link](${event.book.url}) | ID: ${event._id}`,
      inline: false,
    });
  });
  return embed;
}

/**
 * Returns a list of events.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleList: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const eventType = interaction.options.getString("type", true);
    const eventStatus = interaction.options.getString("status", true);
    const data = await bot.apiClient.getEventsList(eventType, eventStatus);
    const pageSize = 5;
    const pagedContentManager = new PaginationManager<EventDto>(
      pageSize,
      data,
      bot,
      getEventsListEmbed,
    );
    const message = await interaction.editReply(
      pagedContentManager.createMessagePayloadForPage(interaction),
    );
    pagedContentManager.createCollectors(message, interaction, 60000);
  } catch (err) {
    logger.error(`Error in handleList: ${err}`);
  }
};
