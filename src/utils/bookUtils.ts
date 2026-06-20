import {
  AuthorDto,
  BookDto,
  GoodreadsBookDto,
  OpenLibraryBookDto,
} from "@organizedbookclub/ows-client";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ContainerBuilder,
  EmbedBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from "discord.js";

import { labels } from "../config/constants";

import { customSubstring } from "./stringUtils";

const OPENLIBRARY_BASE_URL = "https://openlibrary.org";

/**
 * Custom-id prefix for the "Request Buddy Read" button rendered on an
 * Open Library book container. The buddy-read request flow is keyed off
 * the Open Library work id that follows this prefix.
 */
export const OPENLIBRARY_BR_BUTTON_PREFIX = "book-br-";

/**
 * Extracts the Open Library work id (e.g. "OL12345W") from a work URL.
 *
 * @param url The Open Library work URL.
 * @returns The work id, or null if the URL is not a work URL.
 */
export function getOpenLibraryWorkId(url: string): string | null {
  const marker = "/works/";
  const index = url.indexOf(marker);
  if (index === -1) {
    return null;
  }
  const id = url
    .slice(index + marker.length)
    .split("/")[0]
    .split(".")[0];
  return id.length > 0 ? id : null;
}

/**
 * Reconstructs the canonical Open Library work URL from a work id.
 *
 * @param workId The Open Library work id.
 * @returns The canonical work URL.
 */
export function buildOpenLibraryWorkUrl(workId: string): string {
  return `${OPENLIBRARY_BASE_URL}/works/${workId}`;
}

/**
 * Checks whether a URL points to a book source the backend can resolve
 * (Open Library for fresh fetches, plus Goodreads/Storygraph for books
 * already stored in the database).
 *
 * @param url The book URL.
 * @returns True if the URL is from a supported source.
 */
export function isSupportedBookUrl(url: string): boolean {
  return (
    url.includes("openlibrary.org/") ||
    url.includes("goodreads.com/") ||
    url.includes("storygraph.com/")
  );
}

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
 * Builds a ComponentsV2 container listing Open Library search results.
 *
 * @param query The query string.
 * @param bookList The list of book DTOs.
 * @returns The ComponentsV2 container.
 */
export function getOpenLibraryBookSearchContainer(
  query: string,
  bookList: BookDto[],
) {
  const lines = [`## Search results for "${query}"`];
  bookList.forEach((book, index) => {
    const authorString = getAuthorString(book.authors);
    const suffix = authorString ? ` — *${authorString}*` : "";
    lines.push(`\`${index + 1}\` [${book.title}](${book.url})${suffix}`);
  });
  return new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(lines.join("\n")),
  );
}

/**
 * Creates an embed displaying a single book's details fetched from
 * Goodreads. Used by the AI agent's book-lookup render tool
 * (`book_lookup`) to present web-searched Goodreads results.
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
 * Builds the ComponentsV2 message components for a single book's details
 * fetched from Open Library: a container with the book details, followed by
 * a "Request Buddy Read" button (outside the container) that launches the
 * buddy-read request flow for this book directly.
 *
 * @param book The Open Library book DTO.
 * @returns The ComponentsV2 message components.
 */
export function getOpenLibraryBookComponents(book: OpenLibraryBookDto) {
  const authorString = getAuthorString(book.authors);
  const headerLines = [`### [${book.title}](${book.url})`];
  if (authorString) {
    headerLines.push(`-# by ${authorString}`);
  }
  const meta: string[] = [];
  if (book.numPages) {
    meta.push(`📄 ${book.numPages}`);
  }
  if (book.series) {
    meta.push(`📚 ${book.series}`);
  }
  if (meta.length > 0) {
    headerLines.push(`-# ${meta.join("  •  ")}`);
  }

  const headerText = new TextDisplayBuilder().setContent(
    headerLines.join("\n"),
  );
  const container = new ContainerBuilder();
  if (book.coverUrl) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(headerText)
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(book.coverUrl)),
    );
  } else {
    container.addTextDisplayComponents(headerText);
  }

  if (book.description && book.description !== "No description available") {
    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        customSubstring(book.description, 1500),
      ),
    );
  }

  const footerLines: string[] = [];
  if (book.genres.length > 0) {
    footerLines.push(`🔖 ${book.genres.join(", ")}`);
  }
  if (book.avgRating) {
    footerLines.push(
      `⭐ ${Number(book.avgRating.toFixed(2))} (${book.numRatings})`,
    );
  }
  if (footerLines.length > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(footerLines.join("\n")),
    );
  }

  const components: (ContainerBuilder | ActionRowBuilder<ButtonBuilder>)[] = [
    container,
  ];
  const workId = getOpenLibraryWorkId(book.url);
  if (workId) {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${OPENLIBRARY_BR_BUTTON_PREFIX}${workId}`)
          .setLabel(labels.RequestBuddyRead)
          .setEmoji({ name: "📖" })
          .setStyle(ButtonStyle.Primary),
      ),
    );
  }
  return components;
}
