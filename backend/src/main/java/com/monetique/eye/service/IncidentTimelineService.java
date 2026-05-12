package com.monetique.eye.service;

import com.monetique.eye.entity.Incident;
import com.monetique.eye.entity.IncidentTimelineEntry;
import com.monetique.eye.entity.User;
import com.monetique.eye.repository.IncidentTimelineEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class IncidentTimelineService {

    private final IncidentTimelineEntryRepository timelineRepository;
    private final ActivityLogService activityLogService;

    @Transactional
    public void log(Incident incident, User actor, String action, Map<String, Object> payload) {
        IncidentTimelineEntry entry = IncidentTimelineEntry.builder()
                .incident(incident)
                .actor(actor)
                .action(action)
                .payload(payload)
                .build();
        timelineRepository.save(entry);

        // Also log to global activity log
        String envName = incident.getApplication() != null ? 
            incident.getApplication().getEnvironment().getName() : "Global";
        activityLogService.logActivity(
            "Incident #" + incident.getId() + ": " + action.replace('_', ' '),
            "incident",
            envName
        );
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
