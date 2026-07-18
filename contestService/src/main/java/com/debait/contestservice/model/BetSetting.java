package com.debait.contestservice.model;

import jakarta.persistence.*;

@Entity
@Table(name = "bet_settings")
public class BetSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "house_edge_pct", nullable = false)
    private double houseEdgePct = 0.10;

    @Column(name = "min_bet", nullable = false)
    private int minBet = 10;

    @Column(name = "max_bet_pct_of_balance", nullable = false)
    private double maxBetPctOfBalance = 0.50;

    @Column(name = "house_bonus_per_winner", nullable = false)
    private int houseBonusPerWinner = 20;

    @Column(name = "house_bonus_cap_per_match", nullable = false)
    private int houseBonusCapPerMatch = 200;

    @Column(name = "daily_bonus_bet_limit", nullable = false)
    private int dailyBonusBetLimit = 5;

    public BetSetting() {
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public double getHouseEdgePct() {
        return houseEdgePct;
    }

    public void setHouseEdgePct(double houseEdgePct) {
        this.houseEdgePct = houseEdgePct;
    }

    public int getMinBet() {
        return minBet;
    }

    public void setMinBet(int minBet) {
        this.minBet = minBet;
    }

    public double getMaxBetPctOfBalance() {
        return maxBetPctOfBalance;
    }

    public void setMaxBetPctOfBalance(double maxBetPctOfBalance) {
        this.maxBetPctOfBalance = maxBetPctOfBalance;
    }

    public int getHouseBonusPerWinner() {
        return houseBonusPerWinner;
    }

    public void setHouseBonusPerWinner(int houseBonusPerWinner) {
        this.houseBonusPerWinner = houseBonusPerWinner;
    }

    public int getHouseBonusCapPerMatch() {
        return houseBonusCapPerMatch;
    }

    public void setHouseBonusCapPerMatch(int houseBonusCapPerMatch) {
        this.houseBonusCapPerMatch = houseBonusCapPerMatch;
    }

    public int getDailyBonusBetLimit() {
        return dailyBonusBetLimit;
    }

    public void setDailyBonusBetLimit(int dailyBonusBetLimit) {
        this.dailyBonusBetLimit = dailyBonusBetLimit;
    }
}
