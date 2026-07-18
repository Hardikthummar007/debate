package com.debait.contestservice.repository;

import com.debait.contestservice.model.QueueEntry;
import com.debait.contestservice.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface QueueEntryRepository extends JpaRepository<QueueEntry, Long> {
    Optional<QueueEntry> findByUser(User user);
    void deleteByUser(User user);
    boolean existsByUser(User user);
    Optional<QueueEntry> findFirstByTopicAndStanceOrderByJoinedAtAsc(String topic, String stance);

    @Query("SELECT q FROM QueueEntry q WHERE LOWER(TRIM(q.topic)) = LOWER(TRIM(:topic)) AND LOWER(q.stance) = LOWER(:stance) ORDER BY q.joinedAt ASC")
    List<QueueEntry> findMatches(@Param("topic") String topic, @Param("stance") String stance);
}
