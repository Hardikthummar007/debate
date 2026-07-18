package com.debait.contestservice.controller;

import com.debait.contestservice.model.DebateSession;
import com.debait.contestservice.model.User;
import com.debait.contestservice.model.Round;
import com.debait.contestservice.model.Argument;
import com.debait.contestservice.repository.DebateSessionRepository;
import com.debait.contestservice.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
public class UserController {

    private final UserRepository userRepository;
    private final DebateSessionRepository debateSessionRepository;
    private final PasswordEncoder passwordEncoder;

    public UserController(UserRepository userRepository, DebateSessionRepository debateSessionRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.debateSessionRepository = debateSessionRepository;
        this.passwordEncoder = passwordEncoder;
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Logged in user not found"));
    }

    public static class ProfileUpdateRequest {
        private String username;
        private String email;
        private String password;
        private String profilePicture;

        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
        public String getProfilePicture() { return profilePicture; }
        public void setProfilePicture(String profilePicture) { this.profilePicture = profilePicture; }
    }

    public static class RecentDebateDto {
        private Long id;
        private String topic;
        private String userStance;
        private String opponentUsername;
        private String opponentStance;
        private String status;
        private String winnerUsername;
        private LocalDateTime createdTime;

        // Constructor, Getters and Setters
        public RecentDebateDto(Long id, String topic, String userStance, String opponentUsername, 
                               String opponentStance, String status, String winnerUsername, LocalDateTime createdTime) {
            this.id = id;
            this.topic = topic;
            this.userStance = userStance;
            this.opponentUsername = opponentUsername;
            this.opponentStance = opponentStance;
            this.status = status;
            this.winnerUsername = winnerUsername;
            this.createdTime = createdTime;
        }

        public Long getId() { return id; }
        public String getTopic() { return topic; }
        public String getUserStance() { return userStance; }
        public String getOpponentUsername() { return opponentUsername; }
        public String getOpponentStance() { return opponentStance; }
        public String getStatus() { return status; }
        public String getWinnerUsername() { return winnerUsername; }
        public LocalDateTime getCreatedTime() { return createdTime; }
    }

    @GetMapping("/api/users/profile")
    public ResponseEntity<User> getProfile() {
        return ResponseEntity.ok(getCurrentUser());
    }

    @PutMapping("/api/users/profile")
    public ResponseEntity<?> updateProfile(@RequestBody ProfileUpdateRequest request) {
        User currentUser = getCurrentUser();

        if (request.getUsername() != null && !request.getUsername().equals(currentUser.getUsername())) {
            if (userRepository.existsByUsername(request.getUsername())) {
                Map<String, String> response = new HashMap<>();
                response.put("error", "Username is already taken");
                return ResponseEntity.badRequest().body(response);
            }
            currentUser.setUsername(request.getUsername());
        }

        if (request.getEmail() != null && !request.getEmail().equals(currentUser.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                Map<String, String> response = new HashMap<>();
                response.put("error", "Email is already taken");
                return ResponseEntity.badRequest().body(response);
            }
            currentUser.setEmail(request.getEmail());
        }

        if (request.getPassword() != null && !request.getPassword().trim().isEmpty()) {
            currentUser.setPassword(passwordEncoder.encode(request.getPassword()));
        }

        if (request.getProfilePicture() != null) {
            currentUser.setProfilePicture(request.getProfilePicture());
        }

        userRepository.save(currentUser);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Profile updated successfully");
        response.put("username", currentUser.getUsername());
        response.put("email", currentUser.getEmail());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/api/dashboard/stats")
    public ResponseEntity<?> getStats() {
        User currentUser = getCurrentUser();
        Map<String, Object> stats = new HashMap<>();
        stats.put("debatesParticipated", currentUser.getDebatesParticipated());
        stats.put("debatesWon", currentUser.getDebatesWon());
        stats.put("debatesLost", currentUser.getDebatesLost());
        stats.put("debatesDrawn", currentUser.getDebatesDrawn());
        
        double winRate = 0.0;
        if (currentUser.getDebatesParticipated() > 0) {
            winRate = ((double) currentUser.getDebatesWon() / currentUser.getDebatesParticipated()) * 100;
        }
        stats.put("winRate", Math.round(winRate * 100.0) / 100.0);

        return ResponseEntity.ok(stats);
    }

    @GetMapping("/api/dashboard/recent")
    public ResponseEntity<List<RecentDebateDto>> getRecentDebates() {
        User currentUser = getCurrentUser();
        List<DebateSession> debates = debateSessionRepository.findRecentDebatesByUser(currentUser);
        List<RecentDebateDto> dtos = new ArrayList<>();

        for (DebateSession d : debates) {
            String opponentName;
            String opponentStance;
            String userStance;

            if (d.getParticipantA().getId().equals(currentUser.getId())) {
                opponentName = d.getParticipantB().getUsername();
                opponentStance = d.getUserBStance();
                userStance = d.getUserAStance();
            } else {
                opponentName = d.getParticipantA().getUsername();
                opponentStance = d.getUserAStance();
                userStance = d.getUserBStance();
            }

            String winnerName = d.getWinner() != null ? d.getWinner().getUsername() : null;

            dtos.add(new RecentDebateDto(
                    d.getId(),
                    d.getTopic(),
                    userStance,
                    opponentName,
                    opponentStance,
                    d.getStatus(),
                    winnerName,
                    d.getCreatedAt()
            ));
        }

        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/api/dashboard")
    public ResponseEntity<?> getDashboard() {
        User currentUser = getCurrentUser();

        // 1. Calculate stats
        Map<String, Object> stats = new HashMap<>();
        stats.put("participated", currentUser.getDebatesParticipated());
        stats.put("won", currentUser.getDebatesWon());
        stats.put("lost", currentUser.getDebatesLost());
        stats.put("drawn", currentUser.getDebatesDrawn());
        double winRate = 0.0;
        if (currentUser.getDebatesParticipated() > 0) {
            winRate = ((double) currentUser.getDebatesWon() / currentUser.getDebatesParticipated()) * 100;
        }
        stats.put("win_rate", Math.round(winRate * 100.0) / 100.0);

        // 2. Fetch and build recent debates
        List<DebateSession> debates = debateSessionRepository.findRecentDebatesByUser(currentUser);
        List<Map<String, Object>> recentDebatesList = new ArrayList<>();

        LocalDateTime startOfToday = LocalDate.now().atStartOfDay();
        int debatesToday = 0;
        int winsToday = 0;
        boolean wordWarriorDone = false;

        for (DebateSession d : debates) {
            boolean isToday = d.getCreatedAt().isAfter(startOfToday);
            if (isToday) {
                debatesToday++;
                if (d.getWinner() != null && d.getWinner().getId().equals(currentUser.getId())) {
                    winsToday++;
                }

                // Check arguments for word count > 50
                for (Round r : d.getRounds()) {
                    for (Argument arg : r.getArguments()) {
                        if (arg.getUser().getId().equals(currentUser.getId())) {
                            int wc = arg.getContent().trim().split("\\s+").length;
                            if (wc > 50) {
                                wordWarriorDone = true;
                            }
                        }
                    }
                }
            }

            String opponentName;
            String opponentStance;
            String userStance;
            double myScore = 0.0;
            double oppScore = 0.0;

            if (d.getParticipantA().getId().equals(currentUser.getId())) {
                opponentName = d.getParticipantB().getUsername();
                opponentStance = d.getUserBStance();
                userStance = d.getUserAStance();
                myScore = d.getUserATotal();
                oppScore = d.getUserBTotal();
            } else {
                opponentName = d.getParticipantA().getUsername();
                opponentStance = d.getUserAStance();
                userStance = d.getUserBStance();
                myScore = d.getUserBTotal();
                oppScore = d.getUserATotal();
            }

            String result = "in_progress";
            if ("COMPLETED".equals(d.getStatus())) {
                if (d.getWinner() == null) {
                    result = "draw";
                } else if (d.getWinner().getId().equals(currentUser.getId())) {
                    result = "won";
                } else {
                    result = "lost";
                }
            }

            Map<String, Object> dsMap = new HashMap<>();
            dsMap.put("id", d.getId());
            dsMap.put("topic", d.getTopic());
            dsMap.put("result", result);
            dsMap.put("opponent", opponentName);
            dsMap.put("my_side", userStance.toLowerCase());
            dsMap.put("my_score", myScore);
            dsMap.put("opp_score", oppScore);
            dsMap.put("created_at", d.getCreatedAt().toString());

            recentDebatesList.add(dsMap);
        }

        // 3. Build Daily Challenges
        List<Map<String, Object>> dailyChallenges = new ArrayList<>();

        // Challenge 1: First Blood (Win 1 debate today)
        Map<String, Object> challenge1 = new HashMap<>();
        challenge1.put("id", "challenge_1");
        challenge1.put("name", "First Blood");
        challenge1.put("desc", "Claim victory in at least 1 debate battle today.");
        challenge1.put("xp", 50);
        challenge1.put("coins", 10);
        challenge1.put("progress", winsToday >= 1 ? 1 : 0);
        challenge1.put("target", 1);
        challenge1.put("completed", winsToday >= 1);
        dailyChallenges.add(challenge1);

        // Challenge 2: Word Warrior (Submit an argument > 50 words today)
        Map<String, Object> challenge2 = new HashMap<>();
        challenge2.put("id", "challenge_2");
        challenge2.put("name", "Word Warrior");
        challenge2.put("desc", "Slay your opponents with a speech longer than 50 words.");
        challenge2.put("xp", 50);
        challenge2.put("coins", 10);
        challenge2.put("progress", wordWarriorDone ? 1 : 0);
        challenge2.put("target", 1);
        challenge2.put("completed", wordWarriorDone);
        dailyChallenges.add(challenge2);

        // Challenge 3: Double Clash (Participate in 2 debates today)
        Map<String, Object> challenge3 = new HashMap<>();
        challenge3.put("id", "challenge_3");
        challenge3.put("name", "Double Clash");
        challenge3.put("desc", "Join the clash of arguments in at least 2 debate battles today.");
        challenge3.put("xp", 50);
        challenge3.put("coins", 10);
        challenge3.put("progress", Math.min(debatesToday, 2));
        challenge3.put("target", 2);
        challenge3.put("completed", debatesToday >= 2);
        dailyChallenges.add(challenge3);

        // 4. Get Top 10 Leaderboard
        List<User> topUsers = userRepository.findAllByOrderByRatingDesc();
        List<Map<String, Object>> leaderboard = new ArrayList<>();
        int rank = 1;
        for (User u : topUsers) {
            if ("AI_Opponent".equals(u.getUsername())) {
                continue; // Skip the AI itself from user rankings
            }
            Map<String, Object> uMap = new HashMap<>();
            uMap.put("rank", rank++);
            uMap.put("username", u.getUsername());
            uMap.put("title", u.getTitle());
            uMap.put("rating", Math.round(u.getRating()));
            uMap.put("xp", u.getXp());
            uMap.put("selectedAvatar", u.getSelectedAvatar());
            leaderboard.add(uMap);
            if (leaderboard.size() >= 10) break;
        }

        // Return combined data
        Map<String, Object> response = new HashMap<>();
        
        // Build user map with progression stats
        Map<String, Object> userDetails = new HashMap<>();
        userDetails.put("id", currentUser.getId());
        userDetails.put("username", currentUser.getUsername());
        userDetails.put("email", currentUser.getEmail());
        userDetails.put("rating", Math.round(currentUser.getRating()));
        userDetails.put("xp", currentUser.getXp());
        userDetails.put("coins", currentUser.getCoins());
        userDetails.put("title", currentUser.getTitle());
        userDetails.put("streak", currentUser.getStreak());
        userDetails.put("selectedAvatar", currentUser.getSelectedAvatar());
        userDetails.put("unlockedAvatars", currentUser.getUnlockedAvatars());
        userDetails.put("unlockedThemes", currentUser.getUnlockedThemes());
        userDetails.put("profilePicture", currentUser.getProfilePicture());

        response.put("user", userDetails);
        response.put("stats", stats);
        response.put("recent_debates", recentDebatesList);
        response.put("daily_challenges", dailyChallenges);
        response.put("leaderboard", leaderboard);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/api/profile/select-avatar")
    public ResponseEntity<?> selectAvatar(@RequestBody Map<String, String> body) {
        String avatar = body.get("avatar");
        if (avatar == null || avatar.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Avatar name is required"));
        }

        User currentUser = getCurrentUser();
        String[] unlocked = currentUser.getUnlockedAvatars().split(",");
        boolean isUnlocked = false;
        for (String s : unlocked) {
            if (s.trim().equals(avatar)) {
                isUnlocked = true;
                break;
            }
        }

        if (!isUnlocked) {
            return ResponseEntity.badRequest().body(Map.of("error", "Avatar is locked. Unlock it in the Throne Room first."));
        }

        currentUser.setSelectedAvatar(avatar);
        userRepository.save(currentUser);
        return ResponseEntity.ok(Map.of("message", "Avatar updated successfully", "selectedAvatar", avatar));
    }

    @PostMapping("/api/profile/unlock-avatar")
    public ResponseEntity<?> unlockAvatar(@RequestBody Map<String, String> body) {
        String avatar = body.get("avatar");
        if (avatar == null || avatar.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Avatar name is required"));
        }

        User currentUser = getCurrentUser();
        String[] unlocked = currentUser.getUnlockedAvatars().split(",");
        for (String s : unlocked) {
            if (s.trim().equals(avatar)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Avatar is already unlocked"));
            }
        }

        int cost = 50; // Flat price
        if (currentUser.getCoins() < cost) {
            return ResponseEntity.badRequest().body(Map.of("error", "Not enough gold. Win more battles to earn coins."));
        }

        currentUser.setCoins(currentUser.getCoins() - cost);
        currentUser.setUnlockedAvatars(currentUser.getUnlockedAvatars() + "," + avatar);
        userRepository.save(currentUser);

        return ResponseEntity.ok(Map.of(
            "message", "Avatar unlocked successfully",
            "coins", currentUser.getCoins(),
            "unlockedAvatars", currentUser.getUnlockedAvatars()
        ));
    }

    @PostMapping("/api/profile/unlock-theme")
    public ResponseEntity<?> unlockTheme(@RequestBody Map<String, String> body) {
        String theme = body.get("theme");
        if (theme == null || theme.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Theme name is required"));
        }

        User currentUser = getCurrentUser();
        String[] unlocked = currentUser.getUnlockedThemes().split(",");
        for (String s : unlocked) {
            if (s.trim().equals(theme)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Theme is already unlocked"));
            }
        }

        int cost = 100; // Flat price
        if (currentUser.getCoins() < cost) {
            return ResponseEntity.badRequest().body(Map.of("error", "Not enough gold. Win more battles to earn coins."));
        }

        currentUser.setCoins(currentUser.getCoins() - cost);
        currentUser.setUnlockedThemes(currentUser.getUnlockedThemes() + "," + theme);
        userRepository.save(currentUser);

        return ResponseEntity.ok(Map.of(
            "message", "Theme unlocked successfully",
            "coins", currentUser.getCoins(),
            "unlockedThemes", currentUser.getUnlockedThemes()
        ));
    }

    @GetMapping("/api/leaderboard")
    public ResponseEntity<?> getLeaderboard() {
        List<User> topUsers = userRepository.findAllByOrderByRatingDesc();
        List<Map<String, Object>> leaderboard = new ArrayList<>();
        int rank = 1;
        for (User u : topUsers) {
            if ("AI_Opponent".equals(u.getUsername())) {
                continue;
            }
            Map<String, Object> uMap = new HashMap<>();
            uMap.put("rank", rank++);
            uMap.put("username", u.getUsername());
            uMap.put("title", u.getTitle());
            uMap.put("rating", Math.round(u.getRating()));
            uMap.put("xp", u.getXp());
            uMap.put("selectedAvatar", u.getSelectedAvatar());
            leaderboard.add(uMap);
            if (leaderboard.size() >= 50) break; // Limit leaderboard list to top 50
        }
        return ResponseEntity.ok(leaderboard);
    }
}
