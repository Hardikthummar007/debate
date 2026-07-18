package com.debait.contestservice.repository;

import com.debait.contestservice.model.Notification;
import com.debait.contestservice.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserOrderByCreatedAtDesc(User user);
}
