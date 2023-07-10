# Storygraph

## Commands

The `/storygraph` commands are used to interact with [Storygraph](https://app.thestorygraph.com).

| Command  | Options                                               | Description                                                |
| -------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| `search` | `query: string`, `limit: number`, `ephemeral: boolean` | Fetches a list of book links from SG for the given `query` |
| `link`   | `query: string`, `ephemeral: boolean`                  | Fetches a single book link from SG for the given `query`   |
| `book`   | `query: string`, `ephemeral: boolean`                  | Fetches details of a book from SG for the given `query`    |
| `cover`  | `query: string`, `ephemeral: boolean`                  | Fetches cover of a book from SG for the given `query`      |
