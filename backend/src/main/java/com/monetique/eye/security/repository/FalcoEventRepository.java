package com.monetique.eye.security.repository;

import com.monetique.eye.security.entity.FalcoEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface FalcoEventRepository extends JpaRepository<FalcoEvent, Long>, JpaSpecificationExecutor<FalcoEvent> {
    int countByTimestampAfter(LocalDateTime timestamp);
    
    @Query("SELECT COUNT(f) FROM FalcoEvent f WHERE f.node.id IN " +
           "(SELECT n.id FROM ManagedNode n WHERE n.ip IN " +
           "(SELECT a.targetNode FROM Application a WHERE a.id = :applicationId)) " +
           "AND f.timestamp > :timestamp")
    int countByApplicationIdAndTimestampAfter(@Param("applicationId") Long applicationId, @Param("timestamp") LocalDateTime timestamp);
}
