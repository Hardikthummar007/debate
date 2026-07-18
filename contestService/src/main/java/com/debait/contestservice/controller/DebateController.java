package com.debait.contestservice.controller;

import com.debait.contestservice.model.Argument;
import com.debait.contestservice.model.DebateSession;
import com.debait.contestservice.model.Round;
import com.debait.contestservice.model.User;
import com.debait.contestservice.repository.ArgumentRepository;
import com.debait.contestservice.repository.DebateSessionRepository;
import com.debait.contestservice.repository.RoundRepository;
import com.debait.contestservice.repository.UserRepository;
import com.debait.contestservice.service.WagerService;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/debates")
public class DebateController {

    private final UserRepository userRepository;
    private final DebateSessionRepository debateSessionRepository;
    private final RoundRepository roundRepository;
    private final ArgumentRepository argumentRepository;
    private final PlatformTransactionManager transactionManager;
    private final WagerService wagerService;
    private final RestTemplate restTemplate = new RestTemplate();
    private static final HttpClient httpClient = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .build();

    public DebateController(UserRepository userRepository, DebateSessionRepository debateSessionRepository,
            RoundRepository roundRepository, ArgumentRepository argumentRepository,
            PlatformTransactionManager transactionManager, WagerService wagerService) {
        this.userRepository = userRepository;
        this.debateSessionRepository = debateSessionRepository;
        this.roundRepository = roundRepository;
        this.argumentRepository = argumentRepository;
        this.transactionManager = transactionManager;
        this.wagerService = wagerService;
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Logged in user not found"));
    }

    // --- DTO CLASSES FOR CLEAN JSON OUTPUT ---

    public static class DebateSessionDto {
        private Long id;
        private String topic;
        private String status;
        private int currentRound;
        private UserSummaryDto currentUser;
        private UserSummaryDto participantA;
        private UserSummaryDto participantB;
        private String userAStance;
        private String userBStance;
        private double userATotal;
        private double userBTotal;
        private UserSummaryDto winner;
        private List<RoundDto> rounds;

        public DebateSessionDto(DebateSession session) {
            this.id = session.getId();
            this.topic = session.getTopic();
            this.status = session.getStatus();
            this.currentRound = session.getCurrentRound();
            this.currentUser = session.getCurrentUser() != null ? new UserSummaryDto(session.getCurrentUser()) : null;
            this.participantA = new UserSummaryDto(session.getParticipantA());
            this.participantB = new UserSummaryDto(session.getParticipantB());
            this.userAStance = session.getUserAStance();
            this.userBStance = session.getUserBStance();
            this.userATotal = session.getUserATotal();
            this.userBTotal = session.getUserBTotal();
            this.winner = session.getWinner() != null ? new UserSummaryDto(session.getWinner()) : null;

            this.rounds = new ArrayList<>();
            for (Round r : session.getRounds()) {
                this.rounds.add(new RoundDto(r));
            }
            this.rounds.sort(Comparator.comparingInt(RoundDto::getRoundNumber));
        }

        // Getters
        public Long getId() {
            return id;
        }

        public String getTopic() {
            return topic;
        }

        public String getStatus() {
            return status;
        }

        public int getCurrentRound() {
            return currentRound;
        }

        public UserSummaryDto getCurrentUser() {
            return currentUser;
        }

        public UserSummaryDto getParticipantA() {
            return participantA;
        }

        public UserSummaryDto getParticipantB() {
            return participantB;
        }

        public String getUserAStance() {
            return userAStance;
        }

        public String getUserBStance() {
            return userBStance;
        }

        public double getUserATotal() {
            return userATotal;
        }

        public double getUserBTotal() {
            return userBTotal;
        }

        public UserSummaryDto getWinner() {
            return winner;
        }

        public List<RoundDto> getRounds() {
            return rounds;
        }
    }

    public static class UserSummaryDto {
        private Long id;
        private String username;

        public UserSummaryDto(User user) {
            this.id = user.getId();
            this.username = user.getUsername();
        }

        public Long getId() {
            return id;
        }

        public String getUsername() {
            return username;
        }
    }

    public static class RoundDto {
        private int roundNumber;
        private Long winnerId;
        private List<ArgumentDto> arguments;

        public RoundDto(Round round) {
            this.roundNumber = round.getRoundNumber();
            this.winnerId = round.getWinner() != null ? round.getWinner().getId() : null;
            this.arguments = new ArrayList<>();
            for (Argument arg : round.getArguments()) {
                this.arguments.add(new ArgumentDto(arg));
            }
        }

        public int getRoundNumber() {
            return roundNumber;
        }

        public Long getWinnerId() {
            return winnerId;
        }

        public List<ArgumentDto> getArguments() {
            return arguments;
        }
    }

    public static class ArgumentDto {
        private Long userId;
        private String username;
        private String content;
        private double score;
        private String feedback;
        private String reasoning;
        private double topicScore;
        private double relatedScore;
        private double noveltyScore;
        private double factScore;
        private double stanceScore;
        private double deliveryScore;
        private String retrievedFacts;

        public ArgumentDto(Argument arg) {
            this.userId = arg.getUser().getId();
            this.username = arg.getUser().getUsername();
            this.content = arg.getContent();
            this.score = arg.getScore();
            this.feedback = arg.getFeedback();
            this.reasoning = arg.getReasoning();
            this.topicScore = arg.getTopicScore();
            this.relatedScore = arg.getRelatedScore();
            this.noveltyScore = arg.getNoveltyScore();
            this.factScore = arg.getFactScore();
            this.stanceScore = arg.getStanceScore();
            this.deliveryScore = arg.getDeliveryScore();
            this.rawTranscript = arg.getRawTranscript();
            this.retrievedFacts = arg.getRetrievedFacts();
        }

        public Long getUserId() {
            return userId;
        }

        public String getUsername() {
            return username;
        }

        public String getContent() {
            return content;
        }

        public double getScore() {
            return score;
        }

        public String getFeedback() {
            return feedback;
        }

        public String getReasoning() {
            return reasoning;
        }

        public double getTopicScore() {
            return topicScore;
        }

        public double getRelatedScore() {
            return relatedScore;
        }

        public double getNoveltyScore() {
            return noveltyScore;
        }

        public double getFactScore() {
            return factScore;
        }

        public double getStanceScore() {
            return stanceScore;
        }

        public double getDeliveryScore() {
            return deliveryScore;
        }

        public String getRawTranscript() {
            return rawTranscript;
        }

        public String getRetrievedFacts() {
            return retrievedFacts;
        }

        private String rawTranscript;
    }

    public static class ArgumentRequest {
        private String content;
        private String rawTranscript;

        public String getContent() {
            return content;
        }

        public void setContent(String content) {
            this.content = content;
        }

        public String getRawTranscript() {
            return rawTranscript;
        }

        public void setRawTranscript(String rawTranscript) {
            this.rawTranscript = rawTranscript;
        }
    }

    // --- ENDPOINTS ---

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getDebateDetails(@PathVariable("id") Long id) {
        Optional<DebateSession> sessionOpt = debateSessionRepository.findById(id);
        if (sessionOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(new DebateSessionDto(sessionOpt.get()));
    }

    @PostMapping(value = "/{id}/argument", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public synchronized ResponseEntity<SseEmitter> submitArgument(@PathVariable("id") Long id,
            @RequestBody ArgumentRequest request) {
        User currentUser = getCurrentUser();
        Optional<DebateSession> sessionOpt = debateSessionRepository.findById(id);

        if (sessionOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        DebateSession session = sessionOpt.get();

        // 1. Verify session is active
        if (!session.getStatus().equalsIgnoreCase("ACTIVE")) {
            throw new IllegalArgumentException("This debate session has already ended.");
        }

        // 2. Verify it is this user's turn
        if (session.getCurrentUser() == null || !session.getCurrentUser().getId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("It is not your turn to speak.");
        }

        // 3. Find the current round
        int currentRoundNum = session.getCurrentRound();
        Round currentRound = null;
        for (Round r : session.getRounds()) {
            if (r.getRoundNumber() == currentRoundNum) {
                currentRound = r;
                break;
            }
        }

        if (currentRound == null) {
            throw new IllegalArgumentException("Internal error: current round not found.");
        }

        // Verify this user hasn't already submitted an argument for this round
        for (Argument arg : currentRound.getArguments()) {
            if (arg.getUser().getId().equals(currentUser.getId())) {
                throw new IllegalArgumentException("You have already submitted an argument for this round.");
            }
        }

        SseEmitter emitter = new SseEmitter(180000L); // 3 minutes timeout

        // 4. Gather historical arguments and required variables on the main thread
        // to prevent Hibernate LazyInitializationException in the background thread.
        List<String> user1Args = new ArrayList<>();
        List<String> user2Args = new ArrayList<>();

        for (Round r : session.getRounds()) {
            for (Argument arg : r.getArguments()) {
                if (arg.getUser().getId().equals(session.getParticipantA().getId())) {
                    user1Args.add(arg.getContent());
                } else if (arg.getUser().getId().equals(session.getParticipantB().getId())) {
                    user2Args.add(arg.getContent());
                }
            }
        }

        final List<String> finalUser1Args = user1Args;
        final List<String> finalUser2Args = user2Args;
        final String pythonUserRole = currentUser.getId().equals(session.getParticipantA().getId()) ? "user1" : "user2";
        final String topic = session.getTopic();
        final String userAStance = session.getUserAStance();
        final String userBStance = session.getUserBStance();

        final Long currentUserId = currentUser.getId();
        final Long currentRoundId = currentRound.getId();
        final int finalCurrentRoundNum = currentRoundNum;
        final String difficulty = session.getDifficulty() != null ? session.getDifficulty() : "medium";

        new Thread(() -> {
            try {
                // 5. Construct payload for evaluate server
                Map<String, Object> payload = new HashMap<>();
                payload.put("topic", topic);
                payload.put("user1_args", finalUser1Args);
                payload.put("user2_args", finalUser2Args);
                payload.put("user1_stance", userAStance);
                payload.put("user2_stance", userBStance);
                payload.put("current_round", finalCurrentRoundNum);
                payload.put("current_user", pythonUserRole);
                payload.put("current_argument", request.getContent());
                payload.put("raw_transcript",
                        request.getRawTranscript() != null ? request.getRawTranscript() : request.getContent());
                payload.put("is_ai", false);
                payload.put("difficulty", difficulty);

                ObjectMapper mapper = new ObjectMapper();
                String jsonPayload = mapper.writeValueAsString(payload);

                // Call FastAPI Stream
                HttpRequest httpRequest = HttpRequest.newBuilder()
                        .uri(URI.create("http://127.0.0.1:8000/api/evaluate/stream"))
                        .header("Content-Type", "application/json")
                        .header("Accept", "text/event-stream")
                        .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                        .build();

                HttpResponse<InputStream> response = httpClient.send(httpRequest,
                        HttpResponse.BodyHandlers.ofInputStream());

                if (response.statusCode() != 200) {
                    emitter.send(SseEmitter.event()
                            .name("error")
                            .data(Map.of("error",
                                    "AI Evaluation pipeline failed with status " + response.statusCode())));
                    emitter.complete();
                    return;
                }

                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
                    String line;
                    String lastEventName = null;
                    Map<String, Object> finalAiResult = null;

                    while ((line = reader.readLine()) != null) {
                        String trimmed = line.trim();
                        if (trimmed.isEmpty()) {
                            continue;
                        }
                        if (trimmed.startsWith("event:")) {
                            lastEventName = trimmed.substring(6).trim();
                        } else if (trimmed.startsWith("data:")) {
                            String dataStr = trimmed.substring(5).trim();

                            emitter.send(SseEmitter.event()
                                    .name(lastEventName != null ? lastEventName : "message")
                                    .data(dataStr));

                            if ("final_result".equals(lastEventName)) {
                                finalAiResult = mapper.readValue(dataStr, Map.class);
                            }
                        }
                    }

                    if (finalAiResult == null) {
                        emitter.send(SseEmitter.event()
                                .name("error")
                                .data(Map.of("error", "Did not receive final evaluation results from AI pipeline.")));
                        emitter.complete();
                        return;
                    }

                    // 6. Save results to Database inside a single transaction
                    Map<String, Object> finalData = finalAiResult;
                    TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
                    txTemplate.execute(status -> {
                        DebateSession txSession = debateSessionRepository.findById(id).orElseThrow();
                        User txCurrentUser = userRepository.findById(currentUserId).orElseThrow();
                        Round txRound = roundRepository.findById(currentRoundId).orElseThrow();

                        double finalScore = ((Number) finalData.getOrDefault("final_score", 50.0)).doubleValue();
                        double relatedScore = ((Number) finalData.getOrDefault("related_score", 50.0)).doubleValue();
                        double noveltyScore = ((Number) finalData.getOrDefault("novelty_score", 50.0)).doubleValue();
                        double topicScore = ((Number) finalData.getOrDefault("topic_score", 50.0)).doubleValue();
                        double factScore = ((Number) finalData.getOrDefault("fact_score", 50.0)).doubleValue();
                        double stanceScore = ((Number) finalData.getOrDefault("stance_score", 50.0)).doubleValue();
                        double deliveryScore = ((Number) finalData.getOrDefault("delivery_score", 100.0)).doubleValue();

                        List<String> reasoningList = (List<String>) finalData.get("reasoning");
                        String reasoningText = reasoningList != null ? String.join("\n", reasoningList)
                                : "No reasoning details returned.";
                        String retrievedFacts = (String) finalData.getOrDefault("retrieved_facts", "");

                        String feedbackText = "Score: " + finalScore + ". Judges: " + String.join(" | ",
                                reasoningList != null ? reasoningList : Collections.singletonList(""));
                        if (feedbackText.length() > 500) {
                            feedbackText = feedbackText.substring(0, 497) + "...";
                        }

                        Argument argument = new Argument();
                        argument.setRound(txRound);
                        argument.setUser(txCurrentUser);
                        argument.setContent(request.getContent());
                        argument.setScore(finalScore);
                        argument.setFeedback(feedbackText);
                        argument.setReasoning(reasoningText);
                        argument.setTopicScore(topicScore);
                        argument.setRelatedScore(relatedScore);
                        argument.setNoveltyScore(noveltyScore);
                        argument.setFactScore(factScore);
                        argument.setStanceScore(stanceScore);
                        argument.setDeliveryScore(deliveryScore);
                        argument.setRawTranscript(
                                request.getRawTranscript() != null ? request.getRawTranscript() : request.getContent());
                        argument.setRetrievedFacts(retrievedFacts);
                        argumentRepository.save(argument);

                        txRound.getArguments().add(argument);
                        roundRepository.save(txRound);

                        User txOpponent = txCurrentUser.getId().equals(txSession.getParticipantA().getId())
                                ? txSession.getParticipantB()
                                : txSession.getParticipantA();

                        if (txRound.getArguments().size() == 2) {
                            Argument argA = null;
                            Argument argB = null;

                            for (Argument arg : txRound.getArguments()) {
                                if (arg.getUser().getId().equals(txSession.getParticipantA().getId())) {
                                    argA = arg;
                                } else if (arg.getUser().getId().equals(txSession.getParticipantB().getId())) {
                                    argB = arg;
                                }
                            }

                            if (argA != null && argB != null) {
                                if (argA.getScore() > argB.getScore()) {
                                    txRound.setWinner(txSession.getParticipantA());
                                } else if (argB.getScore() > argA.getScore()) {
                                    txRound.setWinner(txSession.getParticipantB());
                                } else {
                                    txRound.setWinner(null);
                                }

                                txSession.setUserATotal(txSession.getUserATotal() + argA.getScore());
                                txSession.setUserBTotal(txSession.getUserBTotal() + argB.getScore());
                            }

                            roundRepository.save(txRound);

                            int nextRound = finalCurrentRoundNum + 1;
                            txSession.setCurrentRound(nextRound);

                            if (nextRound > 3) {
                                txSession.setStatus("COMPLETED");
                                txSession.setCurrentUser(null);

                                User finalWinner;
                                if (txSession.getUserATotal() > txSession.getUserBTotal()) {
                                    finalWinner = txSession.getParticipantA();
                                } else if (txSession.getUserBTotal() > txSession.getUserATotal()) {
                                    finalWinner = txSession.getParticipantB();
                                } else {
                                    finalWinner = null;
                                }
                                txSession.setWinner(finalWinner);

                                wagerService.resolveWagers(txSession);

                                User userA = txSession.getParticipantA();
                                User userB = txSession.getParticipantB();

                                userA.setDebatesParticipated(userA.getDebatesParticipated() + 1);
                                userB.setDebatesParticipated(userB.getDebatesParticipated() + 1);

                                if (finalWinner != null) {
                                    if (finalWinner.getId().equals(userA.getId())) {
                                        userA.setDebatesWon(userA.getDebatesWon() + 1);
                                        userB.setDebatesLost(userB.getDebatesLost() + 1);
                                        updateProgressionForEndDebate(userA, "WON", (int)userB.getRating());
                                        updateProgressionForEndDebate(userB, "LOST", (int)userA.getRating());
                                    } else {
                                        userB.setDebatesWon(userB.getDebatesWon() + 1);
                                        userA.setDebatesLost(userA.getDebatesLost() + 1);
                                        updateProgressionForEndDebate(userB, "WON", (int)userA.getRating());
                                        updateProgressionForEndDebate(userA, "LOST", (int)userB.getRating());
                                    }
                                } else {
                                    userA.setDebatesDrawn(userA.getDebatesDrawn() + 1);
                                    userB.setDebatesDrawn(userB.getDebatesDrawn() + 1);
                                    updateProgressionForEndDebate(userA, "DRAW", (int)userB.getRating());
                                    updateProgressionForEndDebate(userB, "DRAW", (int)userA.getRating());
                                }

                                userRepository.save(userA);
                                userRepository.save(userB);
                            } else {
                                txSession.setCurrentUser(txSession.getParticipantA());
                            }
                        } else {
                            txSession.setCurrentUser(txOpponent);
                        }

                        debateSessionRepository.save(txSession);

                        if (txSession.getCurrentUser() != null
                                && "AI_Opponent".equals(txSession.getCurrentUser().getUsername())) {
                            // Disabled auto-trigger; frontend will request AI turn stream instead
                            // triggerAiTurn(id);
                        }
                        return null;
                    });

                    // 7. Emit done event
                    emitter.send(SseEmitter.event()
                            .name("done")
                            .data(Map.of("message", "Argument processed and saved successfully.")));
                }

                emitter.complete();
            } catch (Exception e) {
                e.printStackTrace();
                try {
                    emitter.send(SseEmitter.event()
                            .name("error")
                            .data(Map.of("error", e.getMessage() != null ? e.getMessage()
                                    : "An unexpected error occurred during AI evaluation.")));
                } catch (Exception se) {
                    // Ignore
                }
                emitter.complete();
            }
        }).start();

        return ResponseEntity.ok().contentType(MediaType.TEXT_EVENT_STREAM).body(emitter);
    }

    public void triggerAiTurn(Long sessionId) {
        new Thread(() -> {
            try {
                // Sleep for 3 seconds to simulate AI thinking
                Thread.sleep(3000);

                TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
                txTemplate.execute(status -> {
                    DebateSession session = debateSessionRepository.findById(sessionId).orElseThrow();
                    if (session.getCurrentUser() == null
                            || !"AI_Opponent".equals(session.getCurrentUser().getUsername())) {
                        return null; // Not AI's turn
                    }

                    // Gather history arguments
                    List<String> user1Args = new ArrayList<>();
                    List<String> user2Args = new ArrayList<>();
                    for (Round r : session.getRounds()) {
                        for (Argument arg : r.getArguments()) {
                            if (arg.getUser().getId().equals(session.getParticipantA().getId())) {
                                user1Args.add(arg.getContent());
                            } else if (arg.getUser().getId().equals(session.getParticipantB().getId())) {
                                user2Args.add(arg.getContent());
                            }
                        }
                    }

                    boolean isAiParticipantA = "AI_Opponent".equals(session.getParticipantA().getUsername());
                    String aiStance = isAiParticipantA ? session.getUserAStance() : session.getUserBStance();
                    List<String> aiArgs = isAiParticipantA ? user1Args : user2Args;
                    List<String> humanArgs = isAiParticipantA ? user2Args : user1Args;

                    // 1. Call FastAPI to generate speech
                    Map<String, Object> genPayload = new HashMap<>();
                    genPayload.put("topic", session.getTopic());
                    genPayload.put("stance", aiStance);
                    genPayload.put("opponent_args", humanArgs);
                    genPayload.put("ai_args", aiArgs);
                    genPayload.put("mode", session.getDifficulty() != null ? session.getDifficulty() : "medium");

                    Map<String, String> genResult = restTemplate.postForObject(
                            "http://127.0.0.1:8000/api/generate_argument", genPayload, Map.class);
                    if (genResult == null || !genResult.containsKey("argument")) {
                        throw new RuntimeException("AI Argument generation failed");
                    }
                    String aiArgumentText = genResult.get("argument");

                    // 2. Call FastAPI to evaluate AI's speech
                    Map<String, Object> evalPayload = new HashMap<>();
                    evalPayload.put("topic", session.getTopic());
                    evalPayload.put("user1_args", user1Args);
                    evalPayload.put("user2_args", user2Args);
                    evalPayload.put("user1_stance", session.getUserAStance());
                    evalPayload.put("user2_stance", session.getUserBStance());
                    evalPayload.put("current_round", session.getCurrentRound());
                    evalPayload.put("current_user", isAiParticipantA ? "user1" : "user2");
                    evalPayload.put("current_argument", aiArgumentText);
                    evalPayload.put("raw_transcript", aiArgumentText);

                    Map<String, Object> aiResult = restTemplate.postForObject(
                            "http://127.0.0.1:8000/api/evaluate", evalPayload, Map.class);
                    if (aiResult == null) {
                        throw new RuntimeException("AI Evaluation failed");
                    }

                    // 3. Parse results
                    double finalScore = ((Number) aiResult.getOrDefault("final_score", 50.0)).doubleValue();
                    double relatedScore = ((Number) aiResult.getOrDefault("related_score", 50.0)).doubleValue();
                    double noveltyScore = ((Number) aiResult.getOrDefault("novelty_score", 50.0)).doubleValue();
                    double topicScore = ((Number) aiResult.getOrDefault("topic_score", 50.0)).doubleValue();
                    double factScore = ((Number) aiResult.getOrDefault("fact_score", 50.0)).doubleValue();
                    double stanceScore = ((Number) aiResult.getOrDefault("stance_score", 50.0)).doubleValue();
                    double deliveryScore = ((Number) aiResult.getOrDefault("delivery_score", 100.0)).doubleValue();

                    List<String> reasoningList = (List<String>) aiResult.get("reasoning");
                    String reasoningText = reasoningList != null ? String.join("\n", reasoningList)
                            : "No reasoning details returned.";
                    String retrievedFacts = (String) aiResult.getOrDefault("retrieved_facts", "");

                    String feedbackText = "Score: " + finalScore + ". Judges: "
                            + String.join(" | ", reasoningList != null ? reasoningList : Collections.singletonList(""));
                    if (feedbackText.length() > 500) {
                        feedbackText = feedbackText.substring(0, 497) + "...";
                    }

                    // 4. Save argument
                    Round txRound = null;
                    for (Round r : session.getRounds()) {
                        if (r.getRoundNumber() == session.getCurrentRound()) {
                            txRound = r;
                            break;
                        }
                    }
                    if (txRound == null) {
                        throw new RuntimeException("Current round not found for session");
                    }

                    User aiUser = isAiParticipantA ? session.getParticipantA() : session.getParticipantB();

                    Argument argument = new Argument();
                    argument.setRound(txRound);
                    argument.setUser(aiUser);
                    argument.setContent(aiArgumentText);
                    argument.setScore(finalScore);
                    argument.setFeedback(feedbackText);
                    argument.setReasoning(reasoningText);
                    argument.setTopicScore(topicScore);
                    argument.setRelatedScore(relatedScore);
                    argument.setNoveltyScore(noveltyScore);
                    argument.setFactScore(factScore);
                    argument.setStanceScore(stanceScore);
                    argument.setDeliveryScore(deliveryScore);
                    argument.setRawTranscript(aiArgumentText);
                    argument.setRetrievedFacts(retrievedFacts);
                    argumentRepository.save(argument);

                    txRound.getArguments().add(argument);
                    roundRepository.save(txRound);

                    // Handle turn management
                    User humanUser = isAiParticipantA ? session.getParticipantB() : session.getParticipantA();
                    if (txRound.getArguments().size() == 2) {
                        Argument argA = null;
                        Argument argB = null;
                        for (Argument arg : txRound.getArguments()) {
                            if (arg.getUser().getId().equals(session.getParticipantA().getId())) {
                                argA = arg;
                            } else if (arg.getUser().getId().equals(session.getParticipantB().getId())) {
                                argB = arg;
                            }
                        }

                        if (argA != null && argB != null) {
                            if (argA.getScore() > argB.getScore()) {
                                txRound.setWinner(session.getParticipantA());
                            } else if (argB.getScore() > argA.getScore()) {
                                txRound.setWinner(session.getParticipantB());
                            } else {
                                txRound.setWinner(null);
                            }
                            session.setUserATotal(session.getUserATotal() + argA.getScore());
                            session.setUserBTotal(session.getUserBTotal() + argB.getScore());
                        }

                        roundRepository.save(txRound);

                        int nextRound = session.getCurrentRound() + 1;
                        session.setCurrentRound(nextRound);

                        if (nextRound > 3) {
                            session.setStatus("COMPLETED");
                            session.setCurrentUser(null);

                            User finalWinner;
                            if (session.getUserATotal() > session.getUserBTotal()) {
                                finalWinner = session.getParticipantA();
                            } else if (session.getUserBTotal() > session.getUserATotal()) {
                                finalWinner = session.getParticipantB();
                            } else {
                                finalWinner = null;
                            }
                            session.setWinner(finalWinner);

                            wagerService.resolveWagers(session);

                            User userA = session.getParticipantA();
                            User userB = session.getParticipantB();
                            userA.setDebatesParticipated(userA.getDebatesParticipated() + 1);
                            userB.setDebatesParticipated(userB.getDebatesParticipated() + 1);

                            if (finalWinner != null) {
                                if (finalWinner.getId().equals(userA.getId())) {
                                    userA.setDebatesWon(userA.getDebatesWon() + 1);
                                    userB.setDebatesLost(userB.getDebatesLost() + 1);
                                    updateProgressionForEndDebate(userA, "WON", (int)userB.getRating());
                                    updateProgressionForEndDebate(userB, "LOST", (int)userA.getRating());
                                } else {
                                    userB.setDebatesWon(userB.getDebatesWon() + 1);
                                    userA.setDebatesLost(userA.getDebatesLost() + 1);
                                    updateProgressionForEndDebate(userB, "WON", (int)userA.getRating());
                                    updateProgressionForEndDebate(userA, "LOST", (int)userB.getRating());
                                }
                            } else {
                                userA.setDebatesDrawn(userA.getDebatesDrawn() + 1);
                                userB.setDebatesDrawn(userB.getDebatesDrawn() + 1);
                                updateProgressionForEndDebate(userA, "DRAW", (int)userB.getRating());
                                updateProgressionForEndDebate(userB, "DRAW", (int)userA.getRating());
                            }

                            userRepository.save(userA);
                            userRepository.save(userB);
                        } else {
                            session.setCurrentUser(session.getParticipantA());
                            // If round incremented, and participant A is the AI, automatically trigger AI
                            // turn again! (Disabled for streaming frontend flow)
                            /*
                            if (isAiParticipantA) {
                                triggerAiTurn(sessionId);
                            }
                            */
                        }
                    } else {
                        session.setCurrentUser(humanUser);
                    }

                    debateSessionRepository.save(session);
                    return null;
                });
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    @PostMapping("/{id}/ai-turn")
    public ResponseEntity<SseEmitter> triggerAiTurnStream(@PathVariable Long id) {
        DebateSession session = debateSessionRepository.findById(id).orElseThrow();
        if (session.getCurrentUser() == null || !"AI_Opponent".equals(session.getCurrentUser().getUsername())) {
            throw new IllegalArgumentException("It is not the AI's turn to speak.");
        }

        SseEmitter emitter = new SseEmitter(180000L); // 3 minutes timeout

        // Gather history
        List<String> user1Args = new ArrayList<>();
        List<String> user2Args = new ArrayList<>();
        for (Round r : session.getRounds()) {
            for (Argument arg : r.getArguments()) {
                if (arg.getUser().getId().equals(session.getParticipantA().getId())) {
                    user1Args.add(arg.getContent());
                } else if (arg.getUser().getId().equals(session.getParticipantB().getId())) {
                    user2Args.add(arg.getContent());
                }
            }
        }

        final List<String> finalUser1Args = user1Args;
        final List<String> finalUser2Args = user2Args;
        final boolean isAiParticipantA = "AI_Opponent".equals(session.getParticipantA().getUsername());
        final String aiStance = isAiParticipantA ? session.getUserAStance() : session.getUserBStance();
        final String userStance = isAiParticipantA ? session.getUserBStance() : session.getUserAStance();
        final List<String> aiArgs = isAiParticipantA ? user1Args : user2Args;
        final List<String> humanArgs = isAiParticipantA ? user2Args : user1Args;
        final String topic = session.getTopic();
        final String difficulty = session.getDifficulty() != null ? session.getDifficulty() : "medium";
        final int currentRoundNum = session.getCurrentRound();

        new Thread(() -> {
            try {
                // Send initial generation update
                emitter.send(SseEmitter.event()
                        .name("message")
                        .data(Map.of("message", "AI is formulating its argument...")));

                // Simulate brief thinking delay
                Thread.sleep(1500);

                // 1. Call FastAPI to generate AI argument
                Map<String, Object> genPayload = new HashMap<>();
                genPayload.put("topic", topic);
                genPayload.put("stance", aiStance);
                genPayload.put("opponent_args", humanArgs);
                genPayload.put("ai_args", aiArgs);
                genPayload.put("mode", difficulty);

                Map<String, String> genResult = restTemplate.postForObject(
                        "http://127.0.0.1:8000/api/generate_argument", genPayload, Map.class);
                if (genResult == null || !genResult.containsKey("argument")) {
                    throw new RuntimeException("AI Argument generation failed");
                }
                String aiArgumentText = genResult.get("argument");

                // Immediately send draft argument back so it renders on frontend
                emitter.send(SseEmitter.event()
                        .name("ai_argument")
                        .data(Map.of("argument", aiArgumentText)));

                // 2. Call FastAPI Evaluate Stream on the generated argument
                Map<String, Object> evalPayload = new HashMap<>();
                evalPayload.put("topic", topic);
                evalPayload.put("user1_args", finalUser1Args);
                evalPayload.put("user2_args", finalUser2Args);
                evalPayload.put("user1_stance", session.getUserAStance());
                evalPayload.put("user2_stance", session.getUserBStance());
                evalPayload.put("current_round", currentRoundNum);
                evalPayload.put("current_user", isAiParticipantA ? "user1" : "user2");
                evalPayload.put("current_argument", aiArgumentText);
                evalPayload.put("raw_transcript", aiArgumentText);
                evalPayload.put("is_ai", true);
                evalPayload.put("difficulty", difficulty);

                ObjectMapper mapper = new ObjectMapper();
                String jsonPayload = mapper.writeValueAsString(evalPayload);

                HttpRequest httpRequest = HttpRequest.newBuilder()
                        .uri(URI.create("http://127.0.0.1:8000/api/evaluate/stream"))
                        .header("Content-Type", "application/json")
                        .header("Accept", "text/event-stream")
                        .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                        .build();

                HttpResponse<InputStream> response = httpClient.send(httpRequest,
                        HttpResponse.BodyHandlers.ofInputStream());

                if (response.statusCode() != 200) {
                    emitter.send(SseEmitter.event()
                            .name("error")
                            .data(Map.of("error", "AI Evaluation pipeline failed with status " + response.statusCode())));
                    emitter.complete();
                    return;
                }

                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
                    String line;
                    String lastEventName = null;
                    Map<String, Object> finalAiResult = null;

                    while ((line = reader.readLine()) != null) {
                        String trimmed = line.trim();
                        if (trimmed.isEmpty()) {
                            continue;
                        }
                        if (trimmed.startsWith("event:")) {
                            lastEventName = trimmed.substring(6).trim();
                        } else if (trimmed.startsWith("data:")) {
                            String dataStr = trimmed.substring(5).trim();

                            emitter.send(SseEmitter.event()
                                    .name(lastEventName != null ? lastEventName : "message")
                                    .data(dataStr));

                            if ("final_result".equals(lastEventName)) {
                                finalAiResult = mapper.readValue(dataStr, Map.class);
                            }
                        }
                    }

                    if (finalAiResult == null) {
                        emitter.send(SseEmitter.event()
                                .name("error")
                                .data(Map.of("error", "Did not receive final evaluation results from AI pipeline.")));
                        emitter.complete();
                        return;
                    }

                    // 3. Save evaluated AI argument to database inside transaction
                    Map<String, Object> finalData = finalAiResult;
                    TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
                    txTemplate.execute(status -> {
                        DebateSession txSession = debateSessionRepository.findById(id).orElseThrow();
                        User aiUser = isAiParticipantA ? txSession.getParticipantA() : txSession.getParticipantB();
                        User humanUser = isAiParticipantA ? txSession.getParticipantB() : txSession.getParticipantA();

                        // Find current round
                        Round txRound = null;
                        for (Round r : txSession.getRounds()) {
                            if (r.getRoundNumber() == currentRoundNum) {
                                txRound = r;
                                break;
                            }
                        }
                        if (txRound == null) {
                            txRound = new Round();
                            txRound.setRoundNumber(currentRoundNum);
                            txRound.setDebateSession(txSession);
                            roundRepository.save(txRound);
                            txSession.getRounds().add(txRound);
                        }

                        double finalScore = ((Number) finalData.getOrDefault("final_score", 50.0)).doubleValue();
                        double relatedScore = ((Number) finalData.getOrDefault("related_score", 50.0)).doubleValue();
                        double noveltyScore = ((Number) finalData.getOrDefault("novelty_score", 50.0)).doubleValue();
                        double topicScore = ((Number) finalData.getOrDefault("topic_score", 50.0)).doubleValue();
                        double factScore = ((Number) finalData.getOrDefault("fact_score", 50.0)).doubleValue();
                        double stanceScore = ((Number) finalData.getOrDefault("stance_score", 50.0)).doubleValue();
                        double deliveryScore = ((Number) finalData.getOrDefault("delivery_score", 100.0)).doubleValue();

                        List<String> reasoningList = (List<String>) finalData.get("reasoning");
                        String reasoningText = reasoningList != null ? String.join("\n", reasoningList)
                                : "No reasoning details returned.";
                        String retrievedFacts = (String) finalData.getOrDefault("retrieved_facts", "");

                        String feedbackText = "Score: " + finalScore + ". Judges: " + String.join(" | ",
                                reasoningList != null ? reasoningList : Collections.singletonList(""));
                        if (feedbackText.length() > 500) {
                            feedbackText = feedbackText.substring(0, 497) + "...";
                        }

                        Argument argument = new Argument();
                        argument.setRound(txRound);
                        argument.setUser(aiUser);
                        argument.setContent(aiArgumentText);
                        argument.setScore(finalScore);
                        argument.setFeedback(feedbackText);
                        argument.setReasoning(reasoningText);
                        argument.setTopicScore(topicScore);
                        argument.setRelatedScore(relatedScore);
                        argument.setNoveltyScore(noveltyScore);
                        argument.setFactScore(factScore);
                        argument.setStanceScore(stanceScore);
                        argument.setDeliveryScore(deliveryScore);
                        argument.setRawTranscript(aiArgumentText);
                        argument.setRetrievedFacts(retrievedFacts);
                        argumentRepository.save(argument);

                        txRound.getArguments().add(argument);
                        roundRepository.save(txRound);

                        if (txRound.getArguments().size() == 2) {
                            Argument argA = null;
                            Argument argB = null;

                            for (Argument arg : txRound.getArguments()) {
                                if (arg.getUser().getId().equals(txSession.getParticipantA().getId())) {
                                    argA = arg;
                                } else if (arg.getUser().getId().equals(txSession.getParticipantB().getId())) {
                                    argB = arg;
                                }
                            }

                            if (argA != null && argB != null) {
                                if (argA.getScore() > argB.getScore()) {
                                    txRound.setWinner(txSession.getParticipantA());
                                } else if (argB.getScore() > argA.getScore()) {
                                    txRound.setWinner(txSession.getParticipantB());
                                } else {
                                    txRound.setWinner(null);
                                }

                                txSession.setUserATotal(txSession.getUserATotal() + argA.getScore());
                                txSession.setUserBTotal(txSession.getUserBTotal() + argB.getScore());
                            }

                            roundRepository.save(txRound);

                            int nextRound = currentRoundNum + 1;
                            txSession.setCurrentRound(nextRound);

                            if (nextRound > 3) {
                                txSession.setStatus("COMPLETED");
                                txSession.setCurrentUser(null);

                                User finalWinner;
                                if (txSession.getUserATotal() > txSession.getUserBTotal()) {
                                    finalWinner = txSession.getParticipantA();
                                } else if (txSession.getUserBTotal() > txSession.getUserATotal()) {
                                    finalWinner = txSession.getParticipantB();
                                } else {
                                    finalWinner = null;
                                }
                                txSession.setWinner(finalWinner);

                                wagerService.resolveWagers(txSession);

                                User userA = txSession.getParticipantA();
                                User userB = txSession.getParticipantB();

                                userA.setDebatesParticipated(userA.getDebatesParticipated() + 1);
                                userB.setDebatesParticipated(userB.getDebatesParticipated() + 1);

                                if (finalWinner != null) {
                                    if (finalWinner.getId().equals(userA.getId())) {
                                        userA.setDebatesWon(userA.getDebatesWon() + 1);
                                        userB.setDebatesLost(userB.getDebatesLost() + 1);
                                        updateProgressionForEndDebate(userA, "WON", (int)userB.getRating());
                                        updateProgressionForEndDebate(userB, "LOST", (int)userA.getRating());
                                    } else {
                                        userB.setDebatesWon(userB.getDebatesWon() + 1);
                                        userA.setDebatesLost(userA.getDebatesLost() + 1);
                                        updateProgressionForEndDebate(userB, "WON", (int)userA.getRating());
                                        updateProgressionForEndDebate(userA, "LOST", (int)userB.getRating());
                                    }
                                } else {
                                    userA.setDebatesDrawn(userA.getDebatesDrawn() + 1);
                                    userB.setDebatesDrawn(userB.getDebatesDrawn() + 1);
                                    updateProgressionForEndDebate(userA, "DRAW", (int)userB.getRating());
                                    updateProgressionForEndDebate(userB, "DRAW", (int)userA.getRating());
                                }

                                userRepository.save(userA);
                                userRepository.save(userB);
                            } else {
                                txSession.setCurrentUser(humanUser);
                            }
                        } else {
                            txSession.setCurrentUser(humanUser);
                        }

                        debateSessionRepository.save(txSession);
                        return null;
                    });

                    // 4. Emit done event
                    emitter.send(SseEmitter.event()
                            .name("done")
                            .data(Map.of("message", "AI argument processed successfully.")));
                }

                emitter.complete();
            } catch (Exception e) {
                e.printStackTrace();
                try {
                    emitter.send(SseEmitter.event()
                            .name("error")
                            .data(Map.of("error", e.getMessage() != null ? e.getMessage()
                                    : "An unexpected error occurred during AI turn.")));
                } catch (Exception se) {
                    // Ignore
                }
                emitter.complete();
            }
        }).start();

        return ResponseEntity.ok().contentType(MediaType.TEXT_EVENT_STREAM).body(emitter);
    }

    private void updateProgressionForEndDebate(User user, String outcome, int opponentRating) {
        if ("AI_Opponent".equals(user.getUsername())) {
            return; // No rewards or ELO updates for the AI entity itself
        }
        
        double currentRating = user.getRating();
        double expected = 1.0 / (1.0 + Math.pow(10, (opponentRating - currentRating) / 400.0));
        
        double actual = 0.5;
        int xpEarned = 50;
        int coinsEarned = 10;
        
        if ("WON".equals(outcome)) {
            actual = 1.0;
            xpEarned = 100;
            coinsEarned = 20;
            int newStreak = user.getStreak() + 1;
            user.setStreak(newStreak);
            if (newStreak >= 3) {
                xpEarned += 50;
                coinsEarned += 10;
            }
        } else if ("LOST".equals(outcome)) {
            actual = 0.0;
            xpEarned = 25;
            coinsEarned = 5;
            user.setStreak(0);
        } else { // DRAW
            actual = 0.5;
            xpEarned = 50;
            coinsEarned = 10;
            user.setStreak(0);
        }
        
        double newRating = currentRating + 32 * (actual - expected);
        user.setRating(newRating);
        
        user.setXp(user.getXp() + xpEarned);
        user.setCoins(user.getCoins() + coinsEarned);
        
        String newTitle = "Peasant";
        if (newRating >= 1800) {
            newTitle = "Emperor";
        } else if (newRating >= 1500) {
            newTitle = "King";
        } else if (newRating >= 1300) {
            newTitle = "Lord";
        } else if (newRating >= 1100) {
            newTitle = "Knight";
        }
        user.setTitle(newTitle);
    }
}

