# QOTD

The `/qotd` command group is for commands related to Question of the Day stuff.

## What's a QOTD?

A QOTD stands for Question Of The Day. A daily question is posted in a specified channel (usually, but not always) book-related, and people answer it.

## Commands

All commands listed below can be used after typing `/qotd` in the chat bar on Discord.

| Command             | Description                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| suggest \<question\>  | Suggests a question                                                                                                                          |
| list                | Lists the available questions                                                                                                                |
| post \<id\> [channel] | Posts a QOTD and creates a thread for it. Selects a random QOTD if id is not given. Selects a pre-configured channel if channel is not given |

## QotD Lifecycle

```mermaid
stateDiagram-v2
    state "Requested" as req
    note left of req
        Buttons are available for staff
        to accept or reject the suggestion
    end note

    state "Rejected" as rej

    state "Accepted" as acc
    note left of acc
        Now the suggestion can be seen
        using the /qotd list command
    end note

    state "Posted" as pos
    note right of pos
        A message is sent and
        a thread is created
    end note

    [*] --> req : /qotd suggest
    req --> rej : On rejection
    req --> acc : On acceptance
    acc --> pos : /qotd post
    pos --> [*]
    rej --> [*]
```
