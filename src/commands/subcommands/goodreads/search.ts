import { BookDto } from "@orgbookclub/ows-client";
import { ChatInputCommandInteraction, Colors, EmbedBuilder } from "discord.js";

import { Bot } from "../../../models/Bot";
import { CommandHandler } from "../../../models/CommandHandler";
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
    const query = interaction.options.getString("query", true);
    const k = interaction.options.getInteger("k") ?? 5;
    const response = await bot.api.goodreads.goodreadsControllerSearchBooks({
      q: query,
      k: k,
    });
    const embed = getGoodreadsSearchEmbed(query, response.data, bot);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error(`Error in handleSearch: ${err}`);
  }
};
