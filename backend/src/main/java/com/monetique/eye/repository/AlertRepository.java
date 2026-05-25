package com.monetique.eye.repository;

import com.monetique.eye.entity.Alert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AlertRepository extends JpaRepository<Alert, Long> {
    List<Alert> findByGroupId(Long groupId);
    java.util.Optional<Alert> findByPrometheusFingerprint(String prometheusFingerprint);
}
