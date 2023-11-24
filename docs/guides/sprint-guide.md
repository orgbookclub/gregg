# Reading Sprints

## What are Reading Sprints?

~~It's when you go on a run while reading a book~~

Reading sprints are when people will focus on reading as many pages while still comprehending the text.

## Sprint Lifecycle

```mermaid
stateDiagram-v2
    state if_state <<choice>>

    state "Scheduled" as sch

    state "Ongoing" as ong
    note left of ong
        User can join using /sprint join
    end note

    state "Cancelled" as can

    state "Finished" as fin
    note right of fin
        User should finish using /sprint finish
        or they will not be counted as a participant
    end note

    state "Completed" as com
    note right of com
        Stats are posted on the thread
    end note

    [*] --> if_state : /sprint start
    if_state --> sch : If delay > 0
    if_state --> ong : If delay = 0
    sch --> ong : delay is over
    sch --> can : /sprint cancel
    ong --> can : /sprint cancel
    can --> [*]
    ong --> fin : duration is over
    fin --> com : after 2 minutes
    com --> [*]
```
