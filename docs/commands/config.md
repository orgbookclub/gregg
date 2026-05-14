# Config (Staff-exclusive)

This command group is for configuring stuff like channels and roles or other parameters that are used in other commands.

## Commands

All commands listed below can be used after typing `/config` in the chat bar on Discord.

| Command                                                       | Description                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| get                                                           | Gets the current guild config for the server                                                                                                                                                                                                                                                                                                                                                                           |
| setreaderrole \<role\> \<points\> [preset]                    | Sets a reader role with its minimum required points. By default points are scored over `All Time`. Pass `preset` (`All Time` / `This Year` / `This Month`) to score points within a calendar window — useful for recognition roles like Reader of the Year or Reader of the Month, which the `updateReaderRoles` job will revoke when the holder no longer qualifies. The role is keyed by Discord role ID — re-running the command on the same role updates the entry in place |
