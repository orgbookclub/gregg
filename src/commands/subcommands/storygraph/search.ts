import { BookDto } from "@orgbookclub/ows-client";
import { ChatInputCommandInteraction, Colors, EmbedBuilder } from "discord.js";

import { CommandHandler, Bot } from "../../../models";
import { getAuthorString } from "../../../utils/bookUtils";
import { logger } from "../../../utils/logHandler";

/**
 * Gets a list of books from SG and returns an embed.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleSearch: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const query = interaction.options.getString("query", true);
    const k = interaction.options.getInteger("k") ?? 5;
    const response = await bot.api.storygraph.storygraphControllerSearchBooks({
      q: query,
      k: k,
    });
    const embed = getStorygraphSearchEmbed(query, response.data);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error(err, `Error in handleSearch`);
  }
};

function getStorygraphSearchEmbed(
  query: string,
  data: BookDto[],
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
    .setFooter({ text: `Fetched from Storygraph` })
    .setColor(Colors.DarkAqua);
  return embed;
}
export { handleSearch };
