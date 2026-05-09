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
| adduser \<id\>                              | Opens a form to add up to 25 users as participants of the event in one submission. Type and points (default 5) are picked in the form |
| removeuser \<id\>                           | Opens a form to remove up to 25 users as participants from the event in one submission. Type is picked in the form                    |
