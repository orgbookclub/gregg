import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bookAsSearchResult,
  bookRequestButtonId,
  bookRequestPrefill,
  parseBookReference,
  parseBookSourceUrl,
} from "../src/modules/engine/books";
import {
  EngineBook,
  EngineBookSearchResult,
} from "../src/modules/engine/types";

const hit: EngineBookSearchResult = {
  bookId: null,
  source: "goodreads",
  externalId: "5907",
  url: "https://www.goodreads.com/book/show/5907",
  title: "The Hobbit",
  authors: ["J.R.R. Tolkien"],
  coverUrl: null,
  pageCount: null,
  publishedYear: null,
  isbn13: null,
};

describe("book references", () => {
  it("recognizes the book page URLs the engine accepts", () => {
    assert.deepEqual(
      parseBookSourceUrl("https://www.goodreads.com/book/show/5907.The_Hobbit"),
      { source: "goodreads", externalId: "5907" },
    );
    assert.deepEqual(
      parseBookSourceUrl("http://goodreads.com/en/book/show/5907-the-hobbit"),
      { source: "goodreads", externalId: "5907" },
    );
    assert.deepEqual(
      parseBookSourceUrl(
        "https://app.thestorygraph.com/books/0A1B2C3D-0000-4000-8000-000000000000",
      ),
      {
        source: "storygraph",
        externalId: "0a1b2c3d-0000-4000-8000-000000000000",
      },
    );
    assert.deepEqual(
      parseBookSourceUrl("https://openlibrary.org/works/OL27482W/The_Hobbit"),
      { source: "openlibrary", externalId: "OL27482W" },
    );
    assert.equal(parseBookSourceUrl("https://www.goodreads.com/work/1"), null);
    assert.equal(
      parseBookSourceUrl("https://evil.example/goodreads.com/book/show/1"),
      null,
    );
    assert.equal(parseBookSourceUrl("ftp://openlibrary.org/works/OL1W"), null);
  });

  it("parses catalogue ids, ISBNs, work ids and URLs", () => {
    assert.deepEqual(parseBookReference(" E2B8BB03BC2562AB6B4B3D48 "), {
      kind: "catalog",
      bookId: "e2b8bb03bc2562ab6b4b3d48",
    });
    assert.deepEqual(parseBookReference("978-0-261-10221-7"), {
      kind: "import",
      ref: { isbn: "9780261102217" },
    });
    assert.deepEqual(parseBookReference("ol27482w"), {
      kind: "import",
      ref: { source: "openlibrary", externalId: "OL27482W" },
    });
    assert.deepEqual(
      parseBookReference("https://www.goodreads.com/book/show/5907"),
      { kind: "import", ref: { source: "goodreads", externalId: "5907" } },
    );
    assert.equal(parseBookReference("the hobbit"), null);
  });
});

describe("Request Buddy Read buttons", () => {
  it("encodes catalogue ids and source identities", () => {
    assert.equal(
      bookRequestButtonId({ ...hit, bookId: "e2b8bb03bc2562ab6b4b3d48" }),
      "book-br-e2b8bb03bc2562ab6b4b3d48",
    );
    assert.equal(bookRequestButtonId(hit), "book-br-goodreads:5907");
    assert.equal(
      bookRequestButtonId({ ...hit, source: "catalog", externalId: null }),
      null,
    );
    const storygraph = bookRequestButtonId({
      ...hit,
      source: "storygraph",
      externalId: "0a1b2c3d-0000-4000-8000-000000000000",
    });
    assert.ok(storygraph && storygraph.length <= 100);
  });

  it("pre-fills the request modal, including pre-engine Open Library buttons", () => {
    assert.equal(
      bookRequestPrefill("book-br-e2b8bb03bc2562ab6b4b3d48"),
      "e2b8bb03bc2562ab6b4b3d48",
    );
    assert.equal(
      bookRequestPrefill("book-br-goodreads:5907"),
      "https://www.goodreads.com/book/show/5907",
    );
    assert.equal(
      bookRequestPrefill("book-br-OL27482W"),
      "https://openlibrary.org/works/OL27482W",
    );
    assert.equal(bookRequestPrefill("book-br-constructor:1"), null);
    assert.equal(bookRequestPrefill("book-br-goodreads:abc"), null);
  });

  it("links catalogue books to their first source", () => {
    const book: EngineBook = {
      id: "e2b8bb03bc2562ab6b4b3d48",
      title: "The Hobbit",
      subtitle: null,
      authors: ["J.R.R. Tolkien"],
      isbn13: null,
      coverUrl: null,
      pageCount: 310,
      publishedYear: 1937,
      description: null,
      genres: [],
      series: null,
      source: "openlibrary",
      externalIds: [
        {
          source: "openlibrary",
          id: "OL27482W",
          url: "https://openlibrary.org/works/OL27482W",
        },
      ],
    };
    const result = bookAsSearchResult(book);
    assert.equal(result.url, "https://openlibrary.org/works/OL27482W");
    assert.equal(result.bookId, book.id);
    assert.equal(bookAsSearchResult({ ...book, externalIds: [] }).url, null);
  });
});
