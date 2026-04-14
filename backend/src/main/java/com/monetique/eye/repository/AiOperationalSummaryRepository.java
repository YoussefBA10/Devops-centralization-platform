package com.monetique.eye.repository;

import com.monetique.eye.entity.AiOperationalSummary;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AiOperationalSummaryRepository extends JpaRepository<AiOperationalSummary, Long> {
    Optional<AiOperationalSummary> findTopByApplicationIdOrderByGeneratedAtDesc(Long applicationId);
}
