import { GoodreadsBookDto } from "@orgbookclub/ows-client";
import { Colors, EmbedBuilder } from "discord.js";

import { CommandHandler } from "../../../models";
import { getAuthorString } from "../../../utils/bookUtils";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * Fetches details of a book from GR.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleBook: CommandHandler = async (bot, interaction) => {
  try {
    const query = interaction.options.getString("query", true);
    const isephemeral = interaction.options.getBoolean("ephemeral") ?? true;
    await interaction.deferReply({ ephemeral: isephemeral });

    const response =
      await bot.api.goodreads.goodreadsControllerSearchAndGetBook({ q: query });

    if (!response) {
      await interaction.editReply("No books found with that query!");
    }

    const embed = getGoodreadsBookEmbed(response.data);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    const error = err as Error;
    if (
      error.name === "AxiosError" &&
      error.message === "Request failed with status code 503"
    ) {
      await interaction.editReply(
        "Unfortunately, due to Goodreads being Goodreads, I cannot complete your request at the moment :(" +
          "\n" +
          "Please try again later, or use Storygraph instead �",
      );
    } else {
      await interaction.editReply(
        "Something went wrong! Please try again later",
      );
      await errorHandler(
        bot,
        "commands > goodreads > book",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  }
};

function getGoodreadsBookEmbed(book: GoodreadsBookDto) {
  const authorUrl = book.authors[0].url;
  const embed = new EmbedBuilder()
    .setTitle(book.title)
    .setURL(book.url)
    .setAuthor({ name: getAuthorString(book.authors), url: authorUrl })
    .setDescription(book.description)
    .setThumbnail(book.coverUrl)
    .addFields(
      { name: "Rating ⭐", value: `${book.avgRating}`, inline: true },
      { name: "Pages 📄", value: `${book.numPages}`, inline: true },
      { name: "Genres 🔖", value: `${book.genres.join(", ")}` },
    )
    .setFooter({ text: `Fetched from Goodreads` })
    .setColor(Colors.Aqua);
  return embed;
}

export { handleBook };
