# Goodreads

## Commands

The `/goodreads` commands are used to interact with [Goodreads](https://goodreads.com).

| Command  | Options                                               | Description                                                |
| -------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| `search` | `query: string`, `limit: number`, `ephemeral: boolean` | Fetches a list of book links from GR for the given `query` |
| `link`   | `query: string`, `ephemeral: boolean`                  | Fetches a single book link from GR for the given `query`   |
| `book`   | `query: string`, `ephemeral: boolean`                  | Fetches details of a book from GR for the given `query`    |
| `cover`  | `query: string`, `ephemeral: boolean`                  | Fetches cover of a book from GR for the given `query`      |
| `quote`  | `query: string`, `ephemeral: boolean`                  | Fetches a random quote from GR for the given `query`       |
