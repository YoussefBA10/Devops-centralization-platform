package com.monetique.eye.repository;

import com.monetique.eye.entity.ActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long>, JpaSpecificationExecutor<ActivityLog> {
    List<ActivityLog> findTop10ByOrderByTimestampDesc();
    List<ActivityLog> findAllByTimestampAfterOrderByTimestampDesc(java.time.Instant timestamp);
}
