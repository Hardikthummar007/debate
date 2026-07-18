package com.debait.contestservice.repository;

import com.debait.contestservice.model.DebateSession;
import com.debait.contestservice.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DebateSessionRepository extends JpaRepository<DebateSession, Long> {
    
    @Query("SELECT d FROM DebateSession d WHERE d.participantA = :user OR d.participantB = :user ORDER BY d.createdAt DESC")
    List<DebateSession> findRecentDebatesByUser(@Param("user") User user);

    @Query("SELECT d FROM DebateSession d WHERE (d.participantA = :user OR d.participantB = :user) AND d.status = 'ACTIVE' ORDER BY d.createdAt DESC")
    List<DebateSession> findActiveSessionsByUser(@Param("user") User user);
}
