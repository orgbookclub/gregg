# Events

The `/events` command group contains commands related to interacting and managing all server reading events.

## Commands

All commands listed below can be used after typing `/events` in the chat bar on Discord.

?\> See [Event Types](guides/events-guide.md#event-types) and [Event Lifecycle](guides/events-guide.md#event-lifecycle) sections for more details before using these commands.

| Command                          | Description                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| info \<id\>                      | Fetches the info for a single event                                                     |
| list [type] [status]             | Fetches a list of events, filtered according to the options                             |
| search \<query\> [type] [status] | Fetches a list of events, filtered via `query` and options                              |
| stats [user]                     | Fetches the server event stats for a user                                               |
| request \<type\>                 | Makes a request for a server reading event                                              |
| broadcast \<id\> [channel]       | Pings all the participants of an event in the event channel, unless otherwise specified |

### Staff-exclusive Commands

| Command                                     | Description                                                                                                                                                      |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| edit \<id\> \<field\> \<value\>             | Updates the `field` of an event with the given `value`                                                                                                           |
| createthread \<id\> [channel] [title]       | Creates or updates a thread for an event. If `title` is given, sets the title of the thread. If `channel` is given, creates a new thread/message in that channel |
| announce \<id\> [channel]                   | Makes an announcement for an approved event. If `channel` is given, does it in that channel                                                                      |
| adduser \<id\> \<user\> \<type\> [points=5] | Adds a user as participant of type `type` to the event, and gives them `points`                                                                                  |
| removeuser \<id\> \<user\> \<type\>         | Removes a user as a participant from the event                                                                                                                   |
