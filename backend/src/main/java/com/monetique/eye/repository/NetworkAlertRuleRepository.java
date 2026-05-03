package com.monetique.eye.repository;

import com.monetique.eye.entity.NetworkAlertRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NetworkAlertRuleRepository extends JpaRepository<NetworkAlertRule, String> {
    List<NetworkAlertRule> findByEnabledTrue();
}
