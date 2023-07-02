import { GoodreadsBookDto } from "@orgbookclub/ows-client";
import { ChatInputCommandInteraction, Colors, EmbedBuilder } from "discord.js";

import { Bot, CommandHandler } from "../../../models";
import { getAuthorString } from "../../../utils/bookUtils";
import { logger } from "../../../utils/logHandler";

/**
 * Gets the GR book information and returns an embed.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleBook: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const query = interaction.options.getString("query", true);
    const response =
      await bot.api.goodreads.goodreadsControllerSearchAndGetBook({ q: query });
    const embed = getGoodreadsBookEmbed(response.data);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error(`Error in handleBook: ${err}`);
  }
};

function getGoodreadsBookEmbed(data: GoodreadsBookDto): EmbedBuilder {
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
    .setFooter({ text: `Fetched from Goodreads` })
    .setColor(Colors.Aqua);
  return embed;
}

export { handleBook };
