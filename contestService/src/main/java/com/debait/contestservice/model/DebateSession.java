package com.debait.contestservice.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "debate_session")
public class DebateSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String topic;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "participant_a_id", nullable = false)
    private User participantA;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "participant_b_id", nullable = false)
    private User participantB;

    @Column(name = "user_a_stance", nullable = false)
    private String userAStance; // "FOR" or "AGAINST"

    @Column(name = "user_b_stance", nullable = false)
    private String userBStance; // "FOR" or "AGAINST"

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "winner_id")
    private User winner;

    @Column(nullable = false)
    private String status = "ACTIVE"; // "ACTIVE", "COMPLETED"

    @Column(name = "current_round", nullable = false)
    private int currentRound = 1;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "current_user_id")
    private User currentUser; // Whose turn it is

    @Column(name = "user_a_total", nullable = false)
    private double userATotal = 0.0;

    @Column(name = "user_b_total", nullable = false)
    private double userBTotal = 0.0;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "difficulty")
    private String difficulty;


    @OneToMany(mappedBy = "debateSession", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<Round> rounds = new ArrayList<>();

    public DebateSession() {
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTopic() {
        return topic;
    }

    public void setTopic(String topic) {
        this.topic = topic;
    }

    public User getParticipantA() {
        return participantA;
    }

    public void setParticipantA(User participantA) {
        this.participantA = participantA;
    }

    public User getParticipantB() {
        return participantB;
    }

    public void setParticipantB(User participantB) {
        this.participantB = participantB;
    }

    public String getUserAStance() {
        return userAStance;
    }

    public void setUserAStance(String userAStance) {
        this.userAStance = userAStance;
    }

    public String getUserBStance() {
        return userBStance;
    }

    public void setUserBStance(String userBStance) {
        this.userBStance = userBStance;
    }

    public User getWinner() {
        return winner;
    }

    public void setWinner(User winner) {
        this.winner = winner;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getCurrentRound() {
        return currentRound;
    }

    public void setCurrentRound(int currentRound) {
        this.currentRound = currentRound;
    }

    public User getCurrentUser() {
        return currentUser;
    }

    public void setCurrentUser(User currentUser) {
        this.currentUser = currentUser;
    }

    public double getUserATotal() {
        return userATotal;
    }

    public void setUserATotal(double userATotal) {
        this.userATotal = userATotal;
    }

    public double getUserBTotal() {
        return userBTotal;
    }

    public void setUserBTotal(double userBTotal) {
        this.userBTotal = userBTotal;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public List<Round> getRounds() {
        return rounds;
    }

    public void setRounds(List<Round> rounds) {
        this.rounds = rounds;
    }

    public String getDifficulty() {
        return difficulty;
    }

    public void setDifficulty(String difficulty) {
        this.difficulty = difficulty;
    }
}
