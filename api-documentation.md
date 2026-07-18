# Debait REST API Documentation

This document describes the REST API endpoints provided by the Spring Boot backend (`contestService`) running on port `8082`.

---

## 1. Authentication Endpoints

### 1.1 User Registration
* **Endpoint**: `POST /api/auth/register`
* **Authentication Required**: None
* **Request Body**:
  ```json
  {
    "username": "testuser",
    "email": "test@example.com",
    "password": "securepassword123"
  }
  ```
* **Response Body** (`200 OK`):
  ```json
  {
    "message": "User registered successfully",
    "userId": 1
  }
  ```
* **Response Body** (`400 Bad Request`):
  ```json
  {
    "error": "Username or Email is already taken"
  }
  ```

### 1.2 User Login
* **Endpoint**: `POST /api/auth/login`
* **Authentication Required**: None
* **Request Body**:
  ```json
  {
    "username": "testuser",
    "password": "securepassword123"
  }
  ```
* **Response Body** (`200 OK`):
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userId": 1,
    "username": "testuser",
    "email": "test@example.com"
  }
  ```
* **Response Body** (`401 Unauthorized`):
  ```json
  {
    "error": "Invalid username or password"
  }
  ```

### 1.3 Get Current User Profile
* **Endpoint**: `GET /api/users/profile`
* **Authentication Required**: Yes (JWT Bearer Token: `Authorization: Bearer <token>`)
* **Response Body** (`200 OK`):
  ```json
  {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "profilePicture": "https://example.com/avatar.png",
    "debatesParticipated": 12,
    "debatesWon": 7,
    "debatesLost": 4,
    "debatesDrawn": 1
  }
  ```

### 1.4 Update User Profile
* **Endpoint**: `PUT /api/users/profile`
* **Authentication Required**: Yes (JWT Bearer Token)
* **Request Body**:
  ```json
  {
    "username": "newusername",
    "email": "newemail@example.com",
    "password": "newoptionalpassword",
    "profilePicture": "https://example.com/avatar_new.png"
  }
  ```
* **Response Body** (`200 OK`):
  ```json
  {
    "message": "Profile updated successfully",
    "username": "newusername",
    "email": "newemail@example.com"
  }
  ```

---

## 2. Topic & Matchmaking Endpoints

### 2.1 Get Debate Topics
* **Endpoint**: `GET /api/topics`
* **Authentication Required**: Yes (JWT Bearer Token)
* **Response Body** (`200 OK`):
  ```json
  [
    {
      "id": "ai-replace-devs",
      "title": "AI will replace software developers",
      "description": "Will Large Language Models and AI coding systems render human software engineering obsolete?"
    },
    {
      "id": "social-media",
      "title": "Social media is beneficial",
      "description": "Has social media improved human connection and society, or has it caused widespread polarization and mental health challenges?"
    },
    {
      "id": "remote-work",
      "title": "Remote work is better than office work",
      "description": "Is fully remote work superior to office-based work in terms of productivity and quality of life?"
    }
  ]
  ```

### 2.2 Join Matchmaking Queue
* **Endpoint**: `POST /api/matchmaking/join`
* **Authentication Required**: Yes (JWT Bearer Token)
* **Request Body**:
  ```json
  {
    "topic": "AI will replace software developers",
    "stance": "FOR"
  }
  ```
* **Response Body** (`200 OK`):
  ```json
  {
    "status": "WAITING",
    "message": "Successfully joined matchmaking queue"
  }
  ```

### 2.3 Leave Matchmaking Queue
* **Endpoint**: `POST /api/matchmaking/leave`
* **Authentication Required**: Yes (JWT Bearer Token)
* **Response Body** (`200 OK`):
  ```json
  {
    "message": "Successfully left matchmaking queue"
  }
  ```

### 2.4 Check Matchmaking Status (Polling)
* **Endpoint**: `GET /api/matchmaking/status`
* **Authentication Required**: Yes (JWT Bearer Token)
* **Response Body** (`200 OK` - Match Not Found Yet):
  ```json
  {
    "status": "WAITING"
  }
  ```
* **Response Body** (`200 OK` - Match Found):
  ```json
  {
    "status": "MATCHED",
    "debateSessionId": 42
  }
  ```

---

## 3. Debate Room Endpoints

### 3.1 Get Debate Session Details
* **Endpoint**: `GET /api/debates/{id}`
* **Authentication Required**: Yes (JWT Bearer Token)
* **Response Body** (`200 OK`):
  ```json
  {
    "id": 42,
    "topic": "AI will replace software developers",
    "status": "ACTIVE",
    "currentRound": 1,
    "currentUser": {
      "id": 1,
      "username": "userA"
    },
    "participantA": {
      "id": 1,
      "username": "userA"
    },
    "participantB": {
      "id": 2,
      "username": "userB"
    },
    "userAStance": "FOR",
    "userBStance": "AGAINST",
    "userATotal": 0.0,
    "userBTotal": 0.0,
    "rounds": [
      {
        "roundNumber": 1,
        "winnerId": null,
        "arguments": [
          {
            "userId": 1,
            "username": "userA",
            "content": "AI will inevitably automate routine code tasks, leaving humans with only high-level architecture.",
            "score": 82.5,
            "feedback": "Strong use of logical structuring.",
            "reasoning": "[Logical Analyst Judge]: Well structured argument...",
            "topicScore": 85.0,
            "relatedScore": 70.0,
            "noveltyScore": 85.0,
            "factScore": 80.0,
            "stanceScore": 90.0
          }
        ]
      }
    ],
    "winner": null
  }
  ```

### 3.2 Submit Debate Argument
* **Endpoint**: `POST /api/debates/{id}/argument`
* **Authentication Required**: Yes (JWT Bearer Token)
* **Request Body**:
  ```json
  {
    "content": "Artificial intelligence cannot reason or understand real-world business context, which is the core of coding."
  }
  ```
* **Response Body** (`200 OK`):
  ```json
  {
    "message": "Argument submitted successfully",
    "score": 78.4,
    "feedback": "Points out context limitation but lacks hard evidence.",
    "reasoning": "[Logical Analyst Judge]: ...",
    "topicScore": 80.0,
    "relatedScore": 78.0,
    "noveltyScore": 85.0,
    "factScore": 72.0,
    "stanceScore": 82.0
  }
  ```
* **Response Body** (`400 Bad Request`):
  ```json
  {
    "error": "It is not your turn to speak"
  }
  ```

---

## 4. Dashboard & Recent Debates Endpoints

### 4.1 Get User Statistics
* **Endpoint**: `GET /api/dashboard/stats`
* **Authentication Required**: Yes (JWT Bearer Token)
* **Response Body** (`200 OK`):
  ```json
  {
    "debatesParticipated": 5,
    "debatesWon": 3,
    "debatesLost": 1,
    "debatesDrawn": 1,
    "winRate": 60.0
  }
  ```

### 4.2 Get Recent Debates
* **Endpoint**: `GET /api/dashboard/recent`
* **Authentication Required**: Yes (JWT Bearer Token)
* **Response Body** (`200 OK`):
  ```json
  [
    {
      "id": 42,
      "topic": "AI will replace software developers",
      "userStance": "FOR",
      "opponentUsername": "userB",
      "opponentStance": "AGAINST",
      "status": "COMPLETED",
      "winnerUsername": "userA",
      "createdTime": "2026-06-29T18:30:00"
    }
  ]
  ```
