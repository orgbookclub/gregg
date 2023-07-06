# User Commands

The `/user` commands are for actions that "pivot" around a user as the key. These can be anything from viewing stats of a user or getting or setting any user profile specific information.

| Command       | Options                                       | Description                                                                                                                                    |
| ------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `events`      | `type:string`, `status: string`, `user: User` | Gets the server event list for the current user or `user` if specified. If `type` and `status` are specified, filters the results accordingly. |
| `info`        | `user: User`                                  | Gets the user info for the current user or `user` if specified. This will display the profile bio (Currently unsupported)                      |
| `readerboard` |                                               | Shows the server reading leaderboard                                                                                                           |
| `stats`       | `user: User`                                  | Gets the server event stats for a user                                                                                                         |
