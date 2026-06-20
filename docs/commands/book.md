# Book

The `/book` command group contains commands that interact with [Open Library](https://openlibrary.org).

## Commands

All commands listed below can be used after typing `/book` in the chat bar on Discord.

?\> By default, the lookup commands (`search`, `link`, `info`, `cover`) respond publicly in the channel. You can make a response private by setting the 'ephemeral' option to 'True'.

| Command                                      | Description                                                |
| -------------------------------------------- | ---------------------------------------------------------- |
| search \<query\> [limit=5] [ephemeral=False] | Fetches a list of book links from Open Library             |
| link \<query\> [ephemeral=False]             | Fetches a single book link from Open Library               |
| info \<query\> [ephemeral=False]             | Fetches details of a book from Open Library                |
| cover \<query\> [ephemeral=False]            | Fetches the cover of a book from Open Library              |
| add \<title\> \<authors\> \<url\> [cover] [pages] [genres] | Manually adds a book to the library (staff only) |

?\> The `/book info` response includes a **Request Buddy Read** button. Clicking it opens the buddy-read request form pre-filled with that book, so you can request the book without copying its link into `/events request`.

## Adding a book manually

The `/book add` command is restricted to staff. It is meant for books that are not available on Open Library.

Once a book has been added, members can request it with `/events request` using the same URL — the backend reuses the stored book instead of fetching it again. The `authors` and `genres` options accept comma-separated lists, and the `url` must be an OpenLibrary, Goodreads, or Storygraph link.
