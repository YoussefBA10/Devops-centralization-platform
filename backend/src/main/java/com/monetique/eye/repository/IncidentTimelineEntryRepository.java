package com.monetique.eye.repository;

import com.monetique.eye.entity.IncidentTimelineEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IncidentTimelineEntryRepository extends JpaRepository<IncidentTimelineEntry, Long> {
    Page<IncidentTimelineEntry> findByIncidentIdOrderByCreatedAtDesc(Long incidentId, Pageable pageable);
}
