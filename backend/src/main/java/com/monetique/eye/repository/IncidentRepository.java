package com.monetique.eye.repository;

import com.monetique.eye.entity.Incident;
import com.monetique.eye.entity.enums.IncidentSeverity;
import com.monetique.eye.entity.enums.IncidentStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IncidentRepository extends JpaRepository<Incident, Long> {
    
    @Query("SELECT i FROM Incident i WHERE " +
           "(:status IS NULL OR i.status = :status) AND " +
           "(:severity IS NULL OR i.severity = :severity) AND " +
           "(:beforeId IS NULL OR i.id < :beforeId) " +
           "ORDER BY i.id DESC")
    List<Incident> findWithFilters(@Param("status") IncidentStatus status,
                                   @Param("severity") IncidentSeverity severity,
                                   @Param("beforeId") Long beforeId,
                                   Pageable pageable);
}
