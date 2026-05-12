package com.monetique.eye.service;

import com.monetique.eye.entity.Incident;
import com.monetique.eye.entity.IncidentTimelineEntry;
import com.monetique.eye.entity.User;
import com.monetique.eye.repository.IncidentTimelineEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
public class IncidentTimelineService {

    private final IncidentTimelineEntryRepository timelineRepository;

    public IncidentTimelineService(IncidentTimelineEntryRepository timelineRepository) {
        this.timelineRepository = timelineRepository;
    }

    @Transactional
    public void log(Incident incident, User actor, String action, Map<String, Object> payload) {
        IncidentTimelineEntry entry = IncidentTimelineEntry.builder()
                .incident(incident)
                .actor(actor)
                .action(action)
                .payload(payload)
                .build();
        timelineRepository.save(entry);
    }
    
    @Transactional
    public void logStatusChange(Incident incident, User actor, String oldStatus, String newStatus) {
        log(incident, actor, "status_changed", Map.of(
                "old_status", oldStatus,
                "new_status", newStatus
        ));
    }

    @Transactional
    public void logNoteAdded(Incident incident, User actor, String note) {
        log(incident, actor, "note_added", Map.of("note", note));
    }

    @Transactional
    public void logAlertAttached(Incident incident, User actor, String alertFingerprint) {
        log(incident, actor, "alert_attached", Map.of("fingerprint", alertFingerprint));
    }
}
