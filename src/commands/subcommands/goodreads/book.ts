import { ChatInputCommandInteraction, Colors, EmbedBuilder } from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { GoodreadsBookDto } from "../../../providers/ows/dto/goodreads-book.dto";
import { getAuthorString } from "../../../utils/bookUtils";
import { logger } from "../../../utils/logHandler";

function getGoodreadsBookEmbed(data: GoodreadsBookDto, bot: Bot): EmbedBuilder {
  const authorUrl = data.authors[0].url;
  const embed = new EmbedBuilder()
    .setTitle(data.title)
    .setURL(data.url)
    .setAuthor({ name: getAuthorString(data.authors), url: authorUrl })
    .setDescription(data.description)
    .setThumbnail(data.coverUrl)
    .addFields(
      { name: "Rating ⭐", value: `${data.avgRating}`, inline: true },
      { name: "Pages 📄", value: `${data.numPages}`, inline: true },
      { name: "Genres 🔖", value: `${data.genres.join(", ")}` },
    )
    .setFooter({ text: `Fetched from Goodreads by ${bot.user?.username}` })
    .setColor(Colors.Aqua);
  return embed;
}

/**
 * Gets the GR book information and returns an embed.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleBook: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const query = interaction.options.getString("query") ?? "";
    const data = await bot.apiClient.getGoodreadsBook(query);
    const embed = getGoodreadsBookEmbed(data, bot);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error(`Error in handleBook: ${err}`);
  }
};
