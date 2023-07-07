# Events

## Commands

The `/events` commands are related to interacting and managing all server reading events.

| Command        | Options                                                      | Description                                                                                                                                                      |
| -------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `info`         | `id: string`                                                 | Fetches the information for a single event                                                                                                                       |
| `list`         | `type: EventType`, `status: EventStatus`                     | Fetches a list of events, filtered according to the options                                                                                                      |
| `search`       | `query: string`, `type: EventType`, `status: EventStatus`    | Fetches a list of events, filtered via `query` and options                                                                                                       |
| `stats`        | `user: User`                                                 | Fetches the server event stats for a user                                                                                                                        |
| `request`      | `type: EventType`                                            | Makes a request for a server reading event                                                                                                                       |
| `broadcast`    | `id: string`, `channel: Channel`                             | Pings all the participants of an event in the event channel, unless otherwise specified                                                                          |
| `edit`         | `id: string`, `field: string`, `value: string`               | Updates the `field` of an event with the given `value`                                                                                                           |
| `createthread` | `id: string`, `channel: Channel`, `title: string`            | Creates or updates a thread for an event. If `title` is given, sets the title of the thread. If `channel` is given, creates a new thread/message in that channel |
| `announce`     | `id: string`, `channel: Channel`                             | Makes an announcement for an approved event. If `channel` is given, does it in that channel                                                                      |
| `adduser`      | `id: string`, `user: User`, `type: string`, `points: number` | Adds a user as participant of type `type` to the event, and gives them `points`                                                                                  |
| `removeuser`   | `id: string`, `user: User`, `type: string`                   | Removes a user as a participant from the event                                                                                                                   |

## Event Lifecyle

### Event Types

### Event States