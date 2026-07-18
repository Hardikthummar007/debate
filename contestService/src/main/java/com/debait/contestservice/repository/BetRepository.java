package com.debait.contestservice.repository;

import com.debait.contestservice.model.Bet;
import com.debait.contestservice.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;

public interface BetRepository extends JpaRepository<Bet, Long> {
    List<Bet> findByMatchId(Long matchId);
    List<Bet> findByUserOrderByCreatedAtDesc(User user);

    @Query("SELECT COUNT(b) FROM Bet b WHERE b.user = :user AND b.status = 'WON' AND b.bonusEarned = true AND b.createdAt >= :since")
    int countWinningBonusBetsSince(@Param("user") User user, @Param("since") LocalDateTime since);
}
