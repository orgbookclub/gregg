import { OPENLIBRARY_BR_BUTTON_PREFIX } from "../../utils/bookUtils";

import {
  EngineBook,
  EngineBookSearchResult,
  EngineBookSourceId,
  EngineImportBookRequest,
} from "./types";

const BOOK_ID_PATTERN = /^[0-9a-f]{24}$/i;
const ISBN_PATTERN = /^(?:\d[\d-]{8,15}[\dXx])$/;
const GOODREADS_ID = /^\d{1,12}$/;
const STORYGRAPH_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OPEN_LIBRARY_WORK_ID = /^OL\d{1,12}W$/;

const SOURCE_HOSTS: Record<EngineBookSourceId, string[]> = {
  goodreads: ["goodreads.com", "www.goodreads.com", "m.goodreads.com"],
  storygraph: [
    "app.thestorygraph.com",
    "thestorygraph.com",
    "www.thestorygraph.com",
  ],
  openlibrary: ["openlibrary.org", "www.openlibrary.org"],
};

const SOURCE_PATHS: Record<EngineBookSourceId, RegExp> = {
  goodreads: /^(?:\/[a-z]{2})?\/book\/show\/(\d+)(?:[-._][^/]*)?\/?$/,
  storygraph: /^\/books\/([0-9a-fA-F-]{36})\/?$/,
  openlibrary: /^\/works\/(OL\d+W)(?:\/[^/]*)?\/?$/,
};

const SOURCE_LABELS: Record<EngineBookSourceId, string> = {
  goodreads: "Goodreads",
  storygraph: "StoryGraph",
  openlibrary: "Open Library",
};

/**
 * Where to find a book on the engine: an existing catalogue book, or an
 * identity to import from a book source.
 */
export type BookReference =
  | { kind: "catalog"; bookId: string }
  | { kind: "import"; ref: EngineImportBookRequest };

/**
 * A book identity at an external source.
 */
export interface BookSourceRef {
  source: EngineBookSourceId;
  externalId: string;
}

/**
 * Whether a string names a book source the engine knows.
 *
 * @param value The value.
 * @returns True for `goodreads`, `storygraph` and `openlibrary`.
 */
export function isBookSourceId(value: string): value is EngineBookSourceId {
  return Object.prototype.hasOwnProperty.call(SOURCE_LABELS, value);
}

/**
 * Validates and canonicalizes a source's external id, matching the engine's
 * rules.
 *
 * @param source The book source.
 * @param rawId The id at that source.
 * @returns The ref, or null when the id is malformed for the source.
 */
export function buildBookSourceRef(
  source: EngineBookSourceId,
  rawId: string,
): BookSourceRef | null {
  const id = rawId.trim();
  switch (source) {
    case "goodreads":
      return GOODREADS_ID.test(id) ? { source, externalId: id } : null;
    case "storygraph": {
      const uuid = id.toLowerCase();
      return STORYGRAPH_ID.test(uuid) ? { source, externalId: uuid } : null;
    }
    case "openlibrary": {
      const workId = id.toUpperCase();
      return OPEN_LIBRARY_WORK_ID.test(workId)
        ? { source, externalId: workId }
        : null;
    }
    default:
      return null;
  }
}

/**
 * Builds the canonical book page URL for a source identity.
 *
 * @param ref The source identity.
 * @returns The URL.
 */
export function bookSourceUrl(ref: BookSourceRef): string {
  switch (ref.source) {
    case "goodreads":
      return `https://www.goodreads.com/book/show/${ref.externalId}`;
    case "storygraph":
      return `https://app.thestorygraph.com/books/${ref.externalId}`;
    case "openlibrary":
      return `https://openlibrary.org/works/${ref.externalId}`;
  }
}

/**
 * Recognizes a Goodreads, StoryGraph or Open Library book page URL.
 *
 * @param input The URL.
 * @returns The source identity, or null when no source recognizes it.
 */
export function parseBookSourceUrl(input: string): BookSourceRef | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  for (const source of Object.keys(SOURCE_HOSTS) as EngineBookSourceId[]) {
    if (!SOURCE_HOSTS[source].includes(host)) continue;
    const match = SOURCE_PATHS[source].exec(url.pathname);
    return match ? buildBookSourceRef(source, match[1]) : null;
  }
  return null;
}

/**
 * Parses what a member typed to identify a book: a catalogue book id, an
 * ISBN, an Open Library work id, or a Goodreads/StoryGraph/Open Library book
 * page URL.
 *
 * @param input The input.
 * @returns The reference, or null when it isn't recognized.
 */
export function parseBookReference(input: string): BookReference | null {
  const value = input.trim();
  if (BOOK_ID_PATTERN.test(value)) {
    return { kind: "catalog", bookId: value.toLowerCase() };
  }
  if (ISBN_PATTERN.test(value)) {
    return { kind: "import", ref: { isbn: value.replace(/-/g, "") } };
  }
  const ref =
    parseBookSourceUrl(value) ??
    (OPEN_LIBRARY_WORK_ID.test(value.toUpperCase())
      ? buildBookSourceRef("openlibrary", value)
      : null);
  return ref ? { kind: "import", ref } : null;
}

/**
 * The display name of a book source.
 *
 * @param source The source id.
 * @returns The label.
 */
export function bookSourceLabel(source: EngineBookSourceId): string {
  return SOURCE_LABELS[source];
}

/**
 * Picks the book page to link for a catalogue book: the first identity in
 * the engine's order, which is Goodreads, then StoryGraph, then Open Library.
 *
 * @param book The catalogue book.
 * @returns The URL, or null for books without an external identity.
 */
export function primaryBookUrl(book: EngineBook): string | null {
  return book.externalIds[0]?.url ?? null;
}

/**
 * Turns a catalogue book into the search-result shape used by the `/book`
 * cards.
 *
 * @param book The catalogue book.
 * @returns The search result.
 */
export function bookAsSearchResult(book: EngineBook): EngineBookSearchResult {
  return {
    bookId: book.id,
    source: "catalog",
    externalId: null,
    url: primaryBookUrl(book),
    title: book.title,
    authors: book.authors,
    coverUrl: book.coverUrl,
    pageCount: book.pageCount,
    publishedYear: book.publishedYear,
    isbn13: book.isbn13,
  };
}

/**
 * Builds the "Request Buddy Read" button id for a search result:
 * `book-br-<catalogue id>` for catalogue books, or
 * `book-br-<source>:<externalId>` for books that are only at a source.
 *
 * @param result The search result.
 * @returns The custom id, or null when the result can't be requested.
 */
export function bookRequestButtonId(
  result: EngineBookSearchResult,
): string | null {
  if (result.bookId) return `${OPENLIBRARY_BR_BUTTON_PREFIX}${result.bookId}`;
  if (result.source === "catalog" || !result.externalId) return null;
  return `${OPENLIBRARY_BR_BUTTON_PREFIX}${result.source}:${result.externalId}`;
}

/**
 * Turns a "Request Buddy Read" button id into the value pre-filled in the
 * request modal: the catalogue id, or the source's book page URL. Buttons
 * posted before the engine (`book-br-OL…W`) are Open Library work ids.
 *
 * @param customId The button custom id.
 * @returns The pre-fill value, or null when the id is malformed.
 */
export function bookRequestPrefill(customId: string): string | null {
  const suffix = customId.slice(OPENLIBRARY_BR_BUTTON_PREFIX.length).trim();
  if (BOOK_ID_PATTERN.test(suffix)) return suffix.toLowerCase();
  const separator = suffix.indexOf(":");
  const source = separator === -1 ? "openlibrary" : suffix.slice(0, separator);
  if (!isBookSourceId(source)) return null;
  const ref = buildBookSourceRef(source, suffix.slice(separator + 1));
  return ref ? bookSourceUrl(ref) : null;
}
