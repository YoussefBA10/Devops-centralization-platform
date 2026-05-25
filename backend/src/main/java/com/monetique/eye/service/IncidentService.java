package com.monetique.eye.service;

import com.monetique.eye.entity.Incident;
import com.monetique.eye.entity.User;
import com.monetique.eye.entity.enums.IncidentSeverity;
import com.monetique.eye.entity.enums.IncidentStatus;
import com.monetique.eye.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class IncidentService {

    private final IncidentRepository incidentRepository;
    private final IncidentTimelineService timelineService;
    private final SecurityService securityService;

    public List<Incident> getIncidents(IncidentStatus status, IncidentSeverity severity, Long beforeId, int size) {
        return incidentRepository.findWithFilters(status, severity, beforeId, PageRequest.of(0, size));
    }

    public Incident getIncident(Long id) {
        return incidentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Incident not found"));
    }

    @Transactional
    public Incident createIncident(Incident incident) {
        // P1/P2 auto-sets status to 'INVESTIGATING' on creation
        if (incident.getSeverity() == IncidentSeverity.P1 || incident.getSeverity() == IncidentSeverity.P2) {
            incident.setStatus(IncidentStatus.INVESTIGATING);
        }
        
        Incident saved = incidentRepository.save(incident);
        timelineService.log(saved, securityService.getCurrentUser(), "incident_created", 
            Map.of("severity", saved.getSeverity(), "status", saved.getStatus()));
        
        if (saved.getLinkedTicket() != null) {
            timelineService.log(saved, securityService.getCurrentUser(), "ticket_raised", 
                Map.of("ticket_id", saved.getLinkedTicket().getId()));
        }
        return saved;
    }

    @Transactional
    public Incident updateStatus(Long id, IncidentStatus newStatus, String resolutionNotes) {
        Incident incident = getIncident(id);
        IncidentStatus oldStatus = incident.getStatus();
        
        if (oldStatus == newStatus) return incident;

        incident.setStatus(newStatus);
        if (newStatus == IncidentStatus.RESOLVED || newStatus == IncidentStatus.CLOSED) {
            incident.setResolvedAt(LocalDateTime.now());
            incident.setResolutionNotes(resolutionNotes);
        }

        Incident saved = incidentRepository.save(incident);
        timelineService.logStatusChange(saved, securityService.getCurrentUser(), oldStatus.name(), newStatus.name());
        
        if (resolutionNotes != null && !resolutionNotes.isEmpty()) {
            timelineService.logNoteAdded(saved, securityService.getCurrentUser(), "Resolution notes: " + resolutionNotes);
        }
        
        return saved;
    }

    @Transactional
    public Incident updateSeverity(Long id, IncidentSeverity newSeverity) {
        Incident incident = getIncident(id);
        IncidentSeverity oldSeverity = incident.getSeverity();
        
        if (oldSeverity == newSeverity) return incident;

        incident.setSeverity(newSeverity);
        Incident saved = incidentRepository.save(incident);
        
        timelineService.log(saved, securityService.getCurrentUser(), "severity_changed", 
            Map.of("old_severity", oldSeverity, "new_severity", newSeverity));
            
        return saved;
    }

    @Transactional
    public Incident assignOwner(Long id, User newOwner) {
        Incident incident = getIncident(id);
        User oldOwner = incident.getOwner();
        
        incident.setOwner(newOwner);
        Incident saved = incidentRepository.save(incident);
        
        timelineService.log(saved, securityService.getCurrentUser(), "owner_assigned", 
            Map.of("new_owner", newOwner != null ? newOwner.getUsername() : "Unassigned"));
            
        return saved;
    }
}
