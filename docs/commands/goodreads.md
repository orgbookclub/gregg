# Goodreads

The `/goodreads` command group contains commands that interact with [Goodreads](https://goodreads.com).

## Commands

All commands listed below can be used after typing `/goodreads` in the chat bar on Discord.

?\> By default, all commands in this module will respond in "ephemeral" messages in Discord. This means that no one else will see the response or know that you used the command. This can be manually turned off by using the 'ephemeral' option explicitly as 'False'

| Command                                   | Description                                              |
| ----------------------------------------- | -------------------------------------------------------- |
| search \<query\> [limit=5] [ephemeral=True] | Fetches a list of book links from GR for the given query |
| link \<query\> [ephemeral=True]             | Fetches a single book link from GR for the given query   |
| book \<query\> [ephemeral=True]             | Fetches details of a book from GR for the given query    |
| cover \<query\> [ephemeral=True]            | Fetches cover of a book from GR for the given query      |
| quote \<query\> [ephemeral=True]            | Fetches a random quote from GR for the given query       |

!\> **IMPORTANT**: The Goodreads redesign has affected how Gregg fetches data from goodreads. You might see error messages or see that commands work only some of the time.
