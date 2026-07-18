package com.debait.contestservice.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "debate_argument")
public class Argument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "round_id", nullable = false)
    @JsonIgnore
    private Round round;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(columnDefinition = "LONGTEXT", nullable = false)
    private String content;

    @Column(nullable = false)
    private double score;

    @Column(columnDefinition = "TEXT")
    private String feedback;

    @Column(columnDefinition = "TEXT")
    private String reasoning;

    @Column(name = "topic_score", nullable = false)
    private double topicScore;

    @Column(name = "related_score", nullable = false)
    private double relatedScore;

    @Column(name = "novelty_score", nullable = false)
    private double noveltyScore;

    @Column(name = "fact_score", nullable = false)
    private double factScore;

    @Column(name = "stance_score", nullable = false)
    private double stanceScore;

    @Column(name = "delivery_score", nullable = false)
    private double deliveryScore;

    @Column(name = "raw_transcript", columnDefinition = "LONGTEXT")
    private String rawTranscript;

    @Column(name = "retrieved_facts", columnDefinition = "LONGTEXT")
    private String retrievedFacts;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Argument() {
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Round getRound() {
        return round;
    }

    public void setRound(Round round) {
        this.round = round;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public double getScore() {
        return score;
    }

    public void setScore(double score) {
        this.score = score;
    }

    public String getFeedback() {
        return feedback;
    }

    public void setFeedback(String feedback) {
        this.feedback = feedback;
    }

    public String getReasoning() {
        return reasoning;
    }

    public void setReasoning(String reasoning) {
        this.reasoning = reasoning;
    }

    public double getTopicScore() {
        return topicScore;
    }

    public void setTopicScore(double topicScore) {
        this.topicScore = topicScore;
    }

    public double getRelatedScore() {
        return relatedScore;
    }

    public void setRelatedScore(double relatedScore) {
        this.relatedScore = relatedScore;
    }

    public double getNoveltyScore() {
        return noveltyScore;
    }

    public void setNoveltyScore(double noveltyScore) {
        this.noveltyScore = noveltyScore;
    }

    public double getFactScore() {
        return factScore;
    }

    public void setFactScore(double factScore) {
        this.factScore = factScore;
    }

    public double getStanceScore() {
        return stanceScore;
    }

    public void setStanceScore(double stanceScore) {
        this.stanceScore = stanceScore;
    }

    public double getDeliveryScore() {
        return deliveryScore;
    }

    public void setDeliveryScore(double deliveryScore) {
        this.deliveryScore = deliveryScore;
    }

    public String getRawTranscript() {
        return rawTranscript;
    }

    public void setRawTranscript(String rawTranscript) {
        this.rawTranscript = rawTranscript;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getRetrievedFacts() {
        return retrievedFacts;
    }

    public void setRetrievedFacts(String retrievedFacts) {
        this.retrievedFacts = retrievedFacts;
    }
}
