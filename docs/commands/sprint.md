# Sprint

## Commands

The `/sprint` commands are related to interacting with reading sprints in the server.

| Command  | Options                             | Description                                                                                               |
| -------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `start`  | `duration: number`, `delay: number` | Schedules a sprint of `duration` minutes in the current channel/thread. Delayed `delay` minutes, if given |
| `join`   | `count: number`                     | Enables a user to join an ongoing sprint with an initial page count                                       |
| `finish` | `count: number`                     | Once a sprint has finished, enables a user to log their end page count                                    |
| `status` |                                     | Shows the current status of the sprint (if present) in the current channel                                |
| `cancel` |                                     | Cancels a sprint in the current channel                                                                   |
| `leave`  |                                     | Enables a user to leave an ongoing sprint                                                                 |
| `stats`  | `user: User`                        | Shows the total sprint stats of a user                                                                    |

## Events

| Event            | Description                                                                       |
| ---------------- | --------------------------------------------------------------------------------- |
| `sprintSchedule` | Fired when a sprint is scheduled with a `delay`. Invokes `sprintStart` afterwards |
| `sprintStart`    | Fired when a sprint is started. Invokes `sprintFinish` afterwards                 |
| `sprintFinish`   | Fired once a sprint has finished. Fires `sprintEnd` after a 2 minute gap          |
| `sprintEnd`      | Fired at the end of a sprint. Logs the sprint to the database                     |

## What are Reading Sprints?

<!-- TODO: Add stuff here -->
