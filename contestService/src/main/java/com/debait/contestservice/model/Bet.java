package com.debait.contestservice.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "bets")
public class Bet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "match_id", nullable = false)
    private Long matchId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String side; // "A" or "B"

    @Column(name = "stake_amount", nullable = false)
    private int stakeAmount;

    @Column(nullable = false)
    private String status = "PENDING"; // "PENDING", "WON", "LOST", "REFUNDED"

    @Column(name = "payout_amount", nullable = false)
    private int payoutAmount = 0;

    @Column(name = "bonus_earned", nullable = false)
    private boolean bonusEarned = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Bet() {
    }

    public Bet(Long matchId, User user, String side, int stakeAmount) {
        this.matchId = matchId;
        this.user = user;
        this.side = side;
        this.stakeAmount = stakeAmount;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getMatchId() {
        return matchId;
    }

    public void setMatchId(Long matchId) {
        this.matchId = matchId;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getSide() {
        return side;
    }

    public void setSide(String side) {
        this.side = side;
    }

    public int getStakeAmount() {
        return stakeAmount;
    }

    public void setStakeAmount(int stakeAmount) {
        this.stakeAmount = stakeAmount;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getPayoutAmount() {
        return payoutAmount;
    }

    public void setPayoutAmount(int payoutAmount) {
        this.payoutAmount = payoutAmount;
    }

    public boolean isBonusEarned() {
        return bonusEarned;
    }

    public void setBonusEarned(boolean bonusEarned) {
        this.bonusEarned = bonusEarned;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
