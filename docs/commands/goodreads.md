# Goodreads Commands

The `/goodreads` commands are used to interact with [Goodreads](https://goodreads.com).

| Command  | Options                                               | Description                                                |
| -------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| `search` | `query: string`, `limit: number`, `ephermal: boolean` | Fetches a list of book links from GR for the given `query` |
| `link`   | `query: string`, `ephermal: boolean`                  | Fetches a single book link from GR for the given `query`   |
| `book`   | `query: string`, `ephermal: boolean`                  | Fetches details of a book from GR for the given `query`    |
| `cover`  | `query: string`, `ephermal: boolean`                  | Fetches cover of a book from GR for the given `query`      |
| `quote`  | `query: string`, `ephermal: boolean`                  | Fetches a random quote from GR for the given `query`       |
