# QOTD

## Commands

The `/qotd` commands are for handling QOTD related things.

| Command   | Options                          | Description                                                                                                                                      |
| --------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `suggest` | `question: string`               | Suggests a question                                                                                                                              |
| `list`    |                                  | Lists the available questions                                                                                                                    |
| `post`    | `id: string`, `channel: Channel` | Posts a QOTD and creates a thread for it. Selects a random QOTD if `id` is not given. Selects a pre-configured channel if `channel` is not given |
