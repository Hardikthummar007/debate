package com.debait.contestservice.controller;

import com.debait.contestservice.model.DebateSession;
import com.debait.contestservice.model.QueueEntry;
import com.debait.contestservice.model.Round;
import com.debait.contestservice.model.User;
import com.debait.contestservice.repository.DebateSessionRepository;
import com.debait.contestservice.repository.QueueEntryRepository;
import com.debait.contestservice.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/matchmaking")
public class MatchmakingController {

    private final UserRepository userRepository;
    private final QueueEntryRepository queueEntryRepository;
    private final DebateSessionRepository debateSessionRepository;
    private final DebateController debateController;
    private final PasswordEncoder passwordEncoder;

    public MatchmakingController(UserRepository userRepository, QueueEntryRepository queueEntryRepository, 
                                 DebateSessionRepository debateSessionRepository, DebateController debateController,
                                 PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.queueEntryRepository = queueEntryRepository;
        this.debateSessionRepository = debateSessionRepository;
        this.debateController = debateController;
        this.passwordEncoder = passwordEncoder;
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Logged in user not found"));
    }

    public static class JoinRequest {
        private String topic;
        private String stance;
        private String difficulty;

        public String getTopic() { return topic; }
        public void setTopic(String topic) { this.topic = topic; }
        public String getStance() { return stance; }
        public void setStance(String stance) { this.stance = stance; }
        public String getDifficulty() { return difficulty; }
        public void setDifficulty(String difficulty) { this.difficulty = difficulty; }
    }

    @PostMapping("/join")
    @Transactional
    public synchronized ResponseEntity<?> joinQueue(@RequestBody JoinRequest request) {
        User currentUser = getCurrentUser();

        // 1. Remove existing queue entry if any (to update stance/topic)
        queueEntryRepository.deleteByUser(currentUser);

        // 2. Determine opposite stance
        String oppositeStance = request.getStance().equalsIgnoreCase("FOR") ? "AGAINST" : "FOR";

        // 3. Search for a matching opponent in the queue
        List<QueueEntry> matches = queueEntryRepository.findMatches(request.getTopic(), oppositeStance);

        if (!matches.isEmpty()) {
            // Sort matches by ELO difference
            matches.sort(Comparator.comparingDouble(entry -> Math.abs(entry.getUser().getRating() - currentUser.getRating())));

            QueueEntry opponentEntry = matches.get(0);
            User opponentUser = opponentEntry.getUser();

            // Delete opponent from queue
            queueEntryRepository.delete(opponentEntry);

            // Create debate session
            DebateSession session = new DebateSession();
            session.setTopic(request.getTopic());
            session.setParticipantA(opponentUser); // User who joined first
            session.setParticipantB(currentUser);  // User who joined second
            session.setUserAStance(opponentEntry.getStance());
            session.setUserBStance(request.getStance());
            session.setStatus("ACTIVE");
            session.setCurrentRound(1);

            // Randomly choose who speaks first
            boolean userASpeaksFirst = new Random().nextBoolean();
            session.setCurrentUser(userASpeaksFirst ? opponentUser : currentUser);

            // Create 3 Rounds
            List<Round> rounds = new ArrayList<>();
            rounds.add(new Round(session, 1));
            rounds.add(new Round(session, 2));
            rounds.add(new Round(session, 3));
            session.setRounds(rounds);

            debateSessionRepository.save(session);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "MATCHED");
            response.put("debateSessionId", session.getId());
            return ResponseEntity.ok(response);
        } else {
            // Put current user in queue
            QueueEntry queueEntry = new QueueEntry(currentUser, request.getTopic(), request.getStance());
            queueEntryRepository.save(queueEntry);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "WAITING");
            response.put("message", "Successfully joined matchmaking queue");
            return ResponseEntity.ok(response);
        }
    }

    @PostMapping("/practice")
    @Transactional
    public synchronized ResponseEntity<?> joinPracticeSession(@RequestBody JoinRequest request) {
        User currentUser = getCurrentUser();

        // 1. Remove existing queue entry if any
        queueEntryRepository.deleteByUser(currentUser);

        // 2. Find or create AI opponent user
        User aiOpponent = userRepository.findByUsername("AI_Opponent").orElseGet(() -> {
            User newUser = new User();
            newUser.setUsername("AI_Opponent");
            newUser.setPassword(passwordEncoder.encode("ai_opponent_pass"));
            newUser.setEmail("ai_opponent@debait.com");
            newUser.setDebatesParticipated(0);
            newUser.setDebatesWon(0);
            newUser.setDebatesLost(0);
            newUser.setDebatesDrawn(0);
            return userRepository.save(newUser);
        });

        // 3. Create debate session matching current user with AI
        DebateSession session = new DebateSession();
        session.setTopic(request.getTopic());
        session.setDifficulty(request.getDifficulty() != null ? request.getDifficulty() : "medium");
        
        // Randomize who is Participant A vs B
        boolean userIsParticipantA = new Random().nextBoolean();
        if (userIsParticipantA) {
            session.setParticipantA(currentUser);
            session.setParticipantB(aiOpponent);
            session.setUserAStance(request.getStance());
            session.setUserBStance(request.getStance().equalsIgnoreCase("FOR") ? "AGAINST" : "FOR");
        } else {
            session.setParticipantA(aiOpponent);
            session.setParticipantB(currentUser);
            session.setUserAStance(request.getStance().equalsIgnoreCase("FOR") ? "AGAINST" : "FOR");
            session.setUserBStance(request.getStance());
        }
        
        session.setStatus("ACTIVE");
        session.setCurrentRound(1);

        // Randomly choose who speaks first
        boolean userSpeaksFirst = new Random().nextBoolean();
        session.setCurrentUser(userSpeaksFirst ? currentUser : aiOpponent);

        // Create 3 Rounds
        List<Round> rounds = new ArrayList<>();
        rounds.add(new Round(session, 1));
        rounds.add(new Round(session, 2));
        rounds.add(new Round(session, 3));
        session.setRounds(rounds);

        debateSessionRepository.save(session);

        // 4. If AI speaks first, trigger AI's turn immediately!
        // Disabled auto-trigger; frontend will request AI turn stream instead
        /*
        if (session.getCurrentUser().getUsername().equals("AI_Opponent")) {
            debateController.triggerAiTurn(session.getId());
        }
        */

        Map<String, Object> response = new HashMap<>();
        response.put("status", "MATCHED");
        response.put("debateSessionId", session.getId());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/leave")
    @Transactional
    public ResponseEntity<?> leaveQueue() {
        User currentUser = getCurrentUser();
        queueEntryRepository.deleteByUser(currentUser);

        Map<String, String> response = new HashMap<>();
        response.put("message", "Successfully left matchmaking queue");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/status")
    @Transactional(readOnly = true)
    public ResponseEntity<?> checkQueueStatus() {
        User currentUser = getCurrentUser();

        // 1. Check if user is in queue
        boolean inQueue = queueEntryRepository.existsByUser(currentUser);
        if (inQueue) {
            Map<String, Object> response = new HashMap<>();
            response.put("status", "WAITING");
            return ResponseEntity.ok(response);
        }

        // 2. Check if user is in an active debate session
        List<DebateSession> activeSessions = debateSessionRepository.findActiveSessionsByUser(currentUser);
        if (!activeSessions.isEmpty()) {
            Map<String, Object> response = new HashMap<>();
            response.put("status", "MATCHED");
            response.put("debateSessionId", activeSessions.get(0).getId());
            return ResponseEntity.ok(response);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("status", "IDLE");
        return ResponseEntity.ok(response);
    }
}
