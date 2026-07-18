# Debait System Flow Documentation

This document describes the architectural flow, matchmaking state machine, and debate turn transitions using Mermaid diagrams.

---

## 1. High-Level Application Flow

The flow of a user from registration to finishing a debate and viewing updated statistics.

```mermaid
graph TD
    A[User Registration / Login] --> B[Dashboard]
    B --> C[Topic & Stance Selection]
    C --> D[Matchmaking Queue]
    D -->|Match Not Found| D
    D -->|Match Found: Opponent Stance / Same Topic| E[Initialize Debate Session]
    E --> F[Round 1: First Speaker Turn]
    F --> G[Argument Submission]
    G --> H[AI Evaluation Server /api/evaluate]
    H --> I[Store Argument & Scores]
    I --> J{Round Completed?}
    J -->|No: Next Speaker Turn| F
    J -->|Yes: Compare Scores| K[Determine Round Winner]
    K --> L{All 3 Rounds Finished?}
    L -->|No: Increment Round| F
    L -->|Yes: Sum Scores| M[Calculate Final Winner]
    M --> N[Update User Stats: Win/Loss/Draw]
    N --> O[Display Results Page]
    O --> B
```

---

## 2. Matchmaking Queue Logic

A database-backed queue manages active connections matching users asynchronously.

```mermaid
sequenceDiagram
    autonumber
    actor User A
    actor User B
    participant DB as MySQL Database
    participant SB as Spring Boot Backend

    User A->>SB: POST /api/matchmaking/join (Topic: AI, Stance: FOR)
    SB->>DB: Query Queue for (Topic: AI, Stance: AGAINST)
    DB-->>SB: No matches found
    SB->>DB: Insert QueueEntry (User A, Topic: AI, Stance: FOR)
    SB-->>User A: Status: WAITING

    Note over User A, SB: User A begins short-polling /api/matchmaking/status

    User B->>SB: POST /api/matchmaking/join (Topic: AI, Stance: AGAINST)
    SB->>DB: Query Queue for (Topic: AI, Stance: FOR)
    DB-->>SB: Match Found! (User A)
    SB->>DB: Create DebateSession (status: ACTIVE, participantA: User A, participantB: User B, turn: Random)
    SB->>DB: Delete QueueEntry for User A
    SB-->>User B: Match Found (Session ID: 42)

    User A->>SB: GET /api/matchmaking/status (Polling)
    SB->>DB: Check active DebateSession for User A
    DB-->>SB: Session Found (Session ID: 42)
    SB-->>User A: Match Found (Session ID: 42)
```

---

## 3. Debate Turn State Machine (Round Progress)

Each round requires both users to submit one argument. Turn transitions are synchronized via polling.

```mermaid
stateDiagram-v2
    [*] --> RoundStart : current_round = 1
    
    state RoundStart {
        [*] --> Speaker1Turn : Randomly assigned starting speaker
        Speaker1Turn --> Evaluating1 : Speaker 1 submits argument
        Evaluating1 --> Speaker2Turn : AI evaluations saved; Switch active turn
        Speaker2Turn --> Evaluating2 : Speaker 2 submits argument
        Evaluating2 --> RoundComplete : AI evaluations saved
    }
    
    RoundComplete --> NextRound : Increment round; Check current_round <= 3
    RoundComplete --> DebateFinished : current_round > 3
    
    NextRound --> RoundStart
    DebateFinished --> [*] : Compute final winner & update stats
```
