package com.debait.contestservice.controller;

import com.debait.contestservice.model.*;
import com.debait.contestservice.repository.*;
import com.debait.contestservice.service.WagerService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/wager")
public class WagerController {

    private final UserRepository userRepository;
    private final DebateSessionRepository debateSessionRepository;
    private final BetRepository betRepository;
    private final NotificationRepository notificationRepository;
    private final WagerService wagerService;

    public WagerController(UserRepository userRepository, DebateSessionRepository debateSessionRepository,
                           BetRepository betRepository, NotificationRepository notificationRepository,
                           WagerService wagerService) {
        this.userRepository = userRepository;
        this.debateSessionRepository = debateSessionRepository;
        this.betRepository = betRepository;
        this.notificationRepository = notificationRepository;
        this.wagerService = wagerService;
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Logged in user not found"));
    }

    @GetMapping("/active")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getActiveMatches() {
        List<DebateSession> sessions = debateSessionRepository.findAll();
        List<Map<String, Object>> responseList = new ArrayList<>();

        for (DebateSession session : sessions) {
            // Only show active debates for wagering
            if (!"ACTIVE".equals(session.getStatus())) {
                continue;
            }

            Map<String, Object> map = new HashMap<>();
            map.put("id", session.getId());
            map.put("topic", session.getTopic());
            map.put("participantA", session.getParticipantA().getUsername());
            map.put("participantAAvatar", session.getParticipantA().getSelectedAvatar());
            map.put("participantARating", session.getParticipantA().getRating());
            map.put("participantB", session.getParticipantB().getUsername());
            map.put("participantBAvatar", session.getParticipantB().getSelectedAvatar());
            map.put("participantBRating", session.getParticipantB().getRating());
            map.put("userAStance", session.getUserAStance());
            map.put("userBStance", session.getUserBStance());
            map.put("status", session.getStatus());
            map.put("currentRound", session.getCurrentRound());

            // Check if betting is locked
            boolean roundOneStarted = !session.getRounds().isEmpty() && 
                    !session.getRounds().get(0).getArguments().isEmpty();
            map.put("isLocked", roundOneStarted || session.getCurrentRound() > 1);

            // Fetch wagers pools
            List<Bet> bets = betRepository.findByMatchId(session.getId());
            int sideAPool = 0;
            int sideBPool = 0;
            int sideABettors = 0;
            int sideBBettors = 0;

            for (Bet bet : bets) {
                if ("A".equals(bet.getSide())) {
                    sideAPool += bet.getStakeAmount();
                    sideABettors++;
                } else {
                    sideBPool += bet.getStakeAmount();
                    sideBBettors++;
                }
            }

            map.put("sideAPool", sideAPool);
            map.put("sideBPool", sideBPool);
            map.put("sideABettors", sideABettors);
            map.put("sideBBettors", sideBBettors);

            responseList.add(map);
        }

        return ResponseEntity.ok(responseList);
    }

    public static class BetRequest {
        private Long matchId;
        private String side;
        private int amount;

        public Long getMatchId() { return matchId; }
        public void setMatchId(Long matchId) { this.matchId = matchId; }
        public String getSide() { return side; }
        public void setSide(String side) { this.side = side; }
        public int getAmount() { return amount; }
        public void setAmount(int amount) { this.amount = amount; }
    }

    @PostMapping("/bet")
    public ResponseEntity<?> placeBet(@RequestBody BetRequest request) {
        try {
            User user = getCurrentUser();
            Bet bet = wagerService.placeBet(user, request.getMatchId(), request.getSide(), request.getAmount());
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Wager successfully registered in the Citadel ledger.");
            response.put("betId", bet.getId());
            response.put("newBalance", user.getCoins());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/history")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getBettingHistory() {
        User user = getCurrentUser();
        List<Bet> bets = betRepository.findByUserOrderByCreatedAtDesc(user);
        List<Map<String, Object>> response = new ArrayList<>();

        for (Bet bet : bets) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", bet.getId());
            map.put("matchId", bet.getMatchId());
            map.put("side", bet.getSide());
            map.put("stakeAmount", bet.getStakeAmount());
            map.put("status", bet.getStatus());
            map.put("payoutAmount", bet.getPayoutAmount());
            map.put("bonusEarned", bet.isBonusEarned());
            map.put("createdAt", bet.getCreatedAt());

            // Include match details if possible
            Optional<DebateSession> sessionOpt = debateSessionRepository.findById(bet.getMatchId());
            if (sessionOpt.isPresent()) {
                DebateSession session = sessionOpt.get();
                map.put("topic", session.getTopic());
                map.put("opponentA", session.getParticipantA().getUsername());
                map.put("opponentB", session.getParticipantB().getUsername());
            } else {
                map.put("topic", "Unknown Battle");
            }
            response.add(map);
        }

        return ResponseEntity.ok(response);
    }

    @GetMapping("/stats")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getBettingStats() {
        User user = getCurrentUser();
        List<Bet> bets = betRepository.findByUserOrderByCreatedAtDesc(user);

        int totalWins = 0;
        int totalLosses = 0;
        int totalRefunds = 0;
        int netGold = 0;

        for (Bet bet : bets) {
            if ("WON".equals(bet.getStatus())) {
                totalWins++;
                netGold += (bet.getPayoutAmount() - bet.getStakeAmount());
            } else if ("LOST".equals(bet.getStatus())) {
                totalLosses++;
                netGold -= bet.getStakeAmount();
            } else if ("REFUNDED".equals(bet.getStatus())) {
                totalRefunds++;
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("totalBets", bets.size());
        response.put("wins", totalWins);
        response.put("losses", totalLosses);
        response.put("refunds", totalRefunds);
        response.put("netGold", netGold);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/settings")
    public ResponseEntity<?> getSettings() {
        return ResponseEntity.ok(wagerService.getSettings());
    }

    @PutMapping("/settings")
    public ResponseEntity<?> updateSettings(@RequestBody BetSetting updates) {
        return ResponseEntity.ok(wagerService.updateSettings(updates));
    }

    @GetMapping("/notifications")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getNotifications() {
        User user = getCurrentUser();
        List<Notification> list = notificationRepository.findByUserOrderByCreatedAtDesc(user);
        List<Map<String, Object>> response = new ArrayList<>();
        for (Notification n : list) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", n.getId());
            map.put("message", n.getMessage());
            map.put("isRead", n.isRead());
            map.put("createdAt", n.getCreatedAt());
            response.add(map);
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/notifications/read")
    @Transactional
    public ResponseEntity<?> readNotifications() {
        User user = getCurrentUser();
        List<Notification> list = notificationRepository.findByUserOrderByCreatedAtDesc(user);
        for (Notification n : list) {
            n.setRead(true);
            notificationRepository.save(n);
        }
        return ResponseEntity.ok(Map.of("message", "All ravens acknowledged."));
    }
}
