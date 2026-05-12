package com.monetique.eye.repository;

import com.monetique.eye.entity.AlertGroup;
import com.monetique.eye.entity.enums.AlertGroupStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AlertGroupRepository extends JpaRepository<AlertGroup, Long> {
    Optional<AlertGroup> findByFingerprint(String fingerprint);
    List<AlertGroup> findByStatus(AlertGroupStatus status);
}
