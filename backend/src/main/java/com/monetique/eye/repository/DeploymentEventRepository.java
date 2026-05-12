package com.monetique.eye.repository;

import com.monetique.eye.entity.DeploymentEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DeploymentEventRepository extends JpaRepository<DeploymentEvent, String> {
    Page<DeploymentEvent> findByApplicationIdAndEnv(Long applicationId, String env, Pageable pageable);
    Page<DeploymentEvent> findByApplicationId(Long applicationId, Pageable pageable);
}
