import {
  AuthorDto,
  BookDto,
  GoodreadsBookDto,
  StorygraphBookDto,
} from "@organizedbookclub/ows-client";
import { EmbedBuilder, Colors } from "discord.js";

/**
 * Processes a list of @see AuthorDto objects and returns a readable string.
 *
 * @param authors An array of @see AuthorDto objects.
 * @param limit The maximum number of authors to display.
 * @returns A comma-separated string of author names.
 */
export const getAuthorString = (authors: AuthorDto[], limit = 3) => {
  const limitedAuthors = authors.slice(0, limit);
  let authorString = "";
  limitedAuthors.forEach(
    (author) =>
      (authorString =
        authorString === "" ? author.name : `${authorString}, ${author.name}`),
  );
  return authorString;
};

/**
 * Creates an embed for book search results.
 *
 * @param query The query string.
 * @param bookList The list of bookDto objects.
 * @param source The source. Can be Goodreads or Storygraph.
 * @returns The book search embed.
 */
export function getBookSearchEmbed(
  query: string,
  bookList: BookDto[],
  source: "Goodreads" | "Storygraph",
) {
  let description = "";
  for (let i = 0; i < bookList.length; i++) {
    const book = bookList[i];
    const authorString = getAuthorString(book.authors);
    const bookString = `\`${i + 1}\` [${book.title}](${
      book.url
    }) - *${authorString}*`;
    description += bookString + "\n";
  }
  const embed = new EmbedBuilder()
    .setTitle(`Search results for "${query}"`)
    .setDescription(description)
    .setFooter({ text: `Fetched from ${source}` })
    .setColor(source === "Goodreads" ? Colors.Aqua : Colors.DarkAqua);
  return embed;
}

/**
 * Creates an embed displaying a single book's details fetched from
 * Goodreads. Shared between the `/goodreads book` slash command and the
 * AI agent's book-lookup render tool so the visual presentation stays
 * in lockstep across surfaces.
 *
 * @param book The Goodreads book DTO.
 * @returns The Goodreads book embed.
 */
export function getGoodreadsBookEmbed(book: GoodreadsBookDto) {
  const authorUrl = book.authors[0].url;
  const embed = new EmbedBuilder()
    .setTitle(book.title)
    .setAuthor({
      name: getAuthorString(book.authors),
      url: authorUrl || undefined,
    })
    .addFields(
      { name: "Rating ⭐", value: `${book.avgRating}`, inline: true },
      { name: "Pages 📄", value: `${book.numPages}`, inline: true },
    )
    .setFooter({ text: `Fetched from Goodreads` })
    .setColor(Colors.Aqua);
  if (book.description) {
    embed.setDescription(book.description);
  }
  if (book.url) {
    embed.setURL(book.url);
  }
  if (book.coverUrl) {
    embed.setThumbnail(book.coverUrl);
  }
  if (book.genres.length > 0) {
    embed.addFields({ name: "Genres 🔖", value: `${book.genres.join(", ")}` });
  }
  return embed;
}

/**
 * Creates an embed displaying a single book's details fetched from
 * Storygraph. Shared between the `/storygraph book` slash command and
 * the AI agent's book-lookup render tool so the visual presentation
 * stays in lockstep across surfaces.
 *
 * @param book The Storygraph book DTO.
 * @returns The Storygraph book embed.
 */
export function getStorygraphBookEmbed(book: StorygraphBookDto) {
  const authorUrl = book.authors[0].url;
  const embed = new EmbedBuilder()
    .setTitle(book.title)
    .setAuthor({
      name: getAuthorString(book.authors),
      url: authorUrl || undefined,
    })
    .addFields(
      { name: "Rating ⭐", value: `${book.avgRating}`, inline: true },
      { name: "Pages 📄", value: book.numPages.toString(), inline: true },
      {
        name: "Moods 🤔",
        value: `${book.moods.slice(0, 3).join(", ")}`,
        inline: false,
      },
      { name: "Pace 🏃‍♂️", value: `${book.pace.join(", ")}`, inline: true },
    )
    .setFooter({ text: `Fetched from Storygraph` })
    .setColor(Colors.DarkAqua);
  if (book.url) {
    embed.setURL(book.url);
  }
  if (book.coverUrl) {
    embed.setThumbnail(book.coverUrl);
  }
  book.quesAns.forEach((element) => {
    embed.addFields({
      name: `🔹 ${element.question}`,
      value: element.answer,
      inline: false,
    });
  });
  return embed;
}
