# QotD

A QOTD stands for Question Of The Day. A daily question is posted in a specified channel (usually, but not always) book-related, and people answer it.

As a User, all you need to do is to suggest qotds using the `/qotd suggest` command. Your suggestion will be Accepted or Rejected by Staff, and will be posted accordingly.

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
