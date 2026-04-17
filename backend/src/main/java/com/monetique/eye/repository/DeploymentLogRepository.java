package com.monetique.eye.repository;

import com.monetique.eye.entity.DeploymentLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeploymentLogRepository extends JpaRepository<DeploymentLog, Long> {
    Optional<DeploymentLog> findTopByTargetIpAndActionOrderByExecutedAtDesc(String targetIp, String action);
    List<DeploymentLog> findByTargetIpAndActionOrderByExecutedAtDesc(String targetIp, String action);
}
