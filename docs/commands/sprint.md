# Sprint

The `/sprint` command group contains all commands related to interacting with reading sprints in the server.

## Commands

All commands listed below can be used after typing `/sprint` in the chat bar on Discord.

| Command                      | Description                                                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| start \<duration\> [delay=0] | Schedules a sprint of the given `duration` (in minutes) in the current channel/thread. If specified, the start is delayed by the given amount |
| join [count=0]               | Enables a user to join an ongoing sprint with an initial page count                                                                           |
| finish \<count\>             | Once a sprint has finished, enables a user to log their end page count                                                                        |
| status                       | Shows the current status of the sprint (if present) in the current channel                                                                    |
| cancel                       | Cancels a sprint in the current channel                                                                                                       |
| leave                        | Enables a user to leave an ongoing sprint                                                                                                     |
| stats [user] [preset] [from] [to] | Shows the total sprint stats of a user. Optional `preset` (`All Time` / `This Year` / `Last Year` / `This Month` / `Past 7 / 30 / 90 Days`) or a custom `from`/`to` range (YYYY-MM-DD, inclusive) filters by sprint end date. Defaults to All Time. Surfaces sprint count + completion rate, total pages, total time + average pace, personal records (best sprint by pages, fastest sprint by pages/min), and a weekly streak (longest, plus current when the window includes this week) |
| leaderboard [metric] [preset] [from] [to] | Shows the top sprinters in the guild. `metric` ranks by `Pages read` (default), `Minutes sprinted`, or `Sprints completed`. Same date-window options as `stats`, including the rolling presets. Pagination + viewer rank surfaced when you appear in the rankings |

