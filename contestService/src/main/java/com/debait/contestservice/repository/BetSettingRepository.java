package com.debait.contestservice.repository;

import com.debait.contestservice.model.BetSetting;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BetSettingRepository extends JpaRepository<BetSetting, Long> {
}
