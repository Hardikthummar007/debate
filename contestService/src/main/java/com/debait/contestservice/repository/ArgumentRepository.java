package com.debait.contestservice.repository;

import com.debait.contestservice.model.Argument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ArgumentRepository extends JpaRepository<Argument, Long> {
}
