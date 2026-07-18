package com.debait.contestservice.model;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(name = "debates_participated", nullable = false)
    private int debatesParticipated = 0;

    @Column(name = "debates_won", nullable = false)
    private int debatesWon = 0;

    @Column(name = "debates_lost", nullable = false)
    private int debatesLost = 0;

    @Column(name = "debates_drawn", nullable = false)
    private int debatesDrawn = 0;

    @Column(name = "profile_picture")
    private String profilePicture;

    @Column(name = "rating", nullable = false)
    private double rating = 1000.0;

    @Column(name = "xp", nullable = false)
    private int xp = 0;

    @Column(name = "coins", nullable = false)
    private int coins = 100;

    @Column(name = "title", nullable = false)
    private String title = "Peasant";

    @Column(name = "streak", nullable = false)
    private int streak = 0;

    @Column(name = "selected_avatar", nullable = false)
    private String selectedAvatar = "knight";

    @Column(name = "unlocked_avatars", nullable = false)
    private String unlockedAvatars = "knight";

    @Column(name = "unlocked_themes", nullable = false)
    private String unlockedThemes = "royal";

    public User() {
    }

    public User(String username, String email, String password) {
        this.username = username;
        this.email = email;
        this.password = password;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public int getDebatesParticipated() {
        return debatesParticipated;
    }

    public void setDebatesParticipated(int debatesParticipated) {
        this.debatesParticipated = debatesParticipated;
    }

    public int getDebatesWon() {
        return debatesWon;
    }

    public void setDebatesWon(int debatesWon) {
        this.debatesWon = debatesWon;
    }

    public int getDebatesLost() {
        return debatesLost;
    }

    public void setDebatesLost(int debatesLost) {
        this.debatesLost = debatesLost;
    }

    public int getDebatesDrawn() {
        return debatesDrawn;
    }

    public void setDebatesDrawn(int debatesDrawn) {
        this.debatesDrawn = debatesDrawn;
    }

    public String getProfilePicture() {
        return profilePicture;
    }

    public void setProfilePicture(String profilePicture) {
        this.profilePicture = profilePicture;
    }

    public double getRating() {
        return rating;
    }

    public void setRating(double rating) {
        this.rating = rating;
    }

    public int getXp() {
        return xp;
    }

    public void setXp(int xp) {
        this.xp = xp;
    }

    public int getCoins() {
        return coins;
    }

    public void setCoins(int coins) {
        this.coins = coins;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public int getStreak() {
        return streak;
    }

    public void setStreak(int streak) {
        this.streak = streak;
    }

    public String getSelectedAvatar() {
        return selectedAvatar;
    }

    public void setSelectedAvatar(String selectedAvatar) {
        this.selectedAvatar = selectedAvatar;
    }

    public String getUnlockedAvatars() {
        return unlockedAvatars;
    }

    public void setUnlockedAvatars(String unlockedAvatars) {
        this.unlockedAvatars = unlockedAvatars;
    }

    public String getUnlockedThemes() {
        return unlockedThemes;
    }

    public void setUnlockedThemes(String unlockedThemes) {
        this.unlockedThemes = unlockedThemes;
    }
}
