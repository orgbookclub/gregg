import { AuthorDto, BookDto } from "@orgbookclub/ows-client";
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
