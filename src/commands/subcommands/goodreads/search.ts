import { ChatInputCommandInteraction, Colors, EmbedBuilder } from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { BookDto } from "../../../providers/ows/dto/book.dto";
import { getAuthorString } from "../../../utils/bookUtils";
import { logger } from "../../../utils/logHandler";

function getGoodreadsSearchEmbed(
  query: string,
  data: BookDto[],
  bot: Bot,
): EmbedBuilder {
  let description = "";
  for (let i = 0; i < data.length; i++) {
    const book = data[i];
    const authorString = getAuthorString(book.authors);
    const bookString = `\`${i + 1}\` [${book.title}](${
      book.url
    }) - *${authorString}*`;
    description += bookString + "\n";
  }
  const embed = new EmbedBuilder()
    .setTitle(`Search results for ${query}`)
    .setDescription(description)
    .setFooter({ text: `Fetched from Goodreads by ${bot.user?.username}` })
    .setColor(Colors.Aqua);
  return embed;
}

/**
 * Gets a list of books from GR and returns an embed.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleSearch: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const query = interaction.options.getString("query") ?? "";
    const k = interaction.options.getInteger("k") ?? 5;
    const data = await bot.apiClient.searchGoodreadsBooks(query, k);
    const embed = getGoodreadsSearchEmbed(query, data, bot);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error(`Error in handleSearch: ${err}`);
  }
};
