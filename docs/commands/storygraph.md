# Storygraph

The `/storygraph` command group contains commands that interact with [Storygraph](https://app.thestorygraph.com).

## Commands

All commands listed below can be used after typing `/storygraph` in the chat bar on Discord.

?\> By default, all commands in this module will respond in "ephemeral" messages in Discord. This means that no one else will see the response or know that you used the command. This can be manually turned off by using the 'ephemeral' option explicitly as 'False'

| Command                                   | Description                                              |
| ----------------------------------------- | -------------------------------------------------------- |
| search \<query\> [limit=5] [ephemeral=True] | Fetches a list of book links from SG for the given query |
| link \<query\> [ephemeral=True]             | Fetches a single book link from SG for the given query   |
| book \<query\> [ephemeral=True]             | Fetches details of a book from SG for the given query    |
| cover \<query\> [ephemeral=True]            | Fetches cover of a book from SG for the given query      |
