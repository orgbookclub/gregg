# User

The `/user` command group are for actions that pivot around a user. These can be anything from viewing stats of a user or getting or setting any user profile specific information.

## Commands

All commands listed below can be used after typing `/user` in the chat bar on Discord.

| Command                           | Description                                                                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| events \<type\> \<status\> [user] | Gets the server event list for the current user or the specified user. Filters the results according to the given event type and event status |
| info [user]                       | Gets the user info for the current user or the specified user. This will display the profile bio (Currently unsupported)                      |
| readerboard [type] [preset] [from] [to]  | Shows the server reading leaderboard. Optional `type` filters to a single event type (BR / MR / etc.). Optional `preset` (`This Year` / `Last Year` / `This Month`) or a custom `from`/`to` range (YYYY-MM-DD, inclusive) — filters by event end date. Defaults to All Time. `preset` and `from`/`to` are mutually exclusive. Surfaces your rank when you appear in the rankings |
