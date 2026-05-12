package com.monetique.eye.controller;

import com.monetique.eye.dto.IncidentDTO;
import com.monetique.eye.entity.Incident;
import com.monetique.eye.entity.IncidentAttachment;
import com.monetique.eye.entity.IncidentTimelineEntry;
import com.monetique.eye.entity.enums.IncidentSeverity;
import com.monetique.eye.entity.enums.IncidentStatus;
import com.monetique.eye.repository.IncidentAttachmentRepository;
import com.monetique.eye.repository.IncidentTimelineEntryRepository;
import com.monetique.eye.repository.UserRepository;
import com.monetique.eye.service.IncidentService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/incidents")
@RequiredArgsConstructor
public class IncidentController {

    private final IncidentService incidentService;
    private final IncidentTimelineEntryRepository timelineRepository;
    private final IncidentAttachmentRepository attachmentRepository;
    private final UserRepository userRepository;

    @GetMapping
    public List<IncidentDTO> getIncidents(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) Long before_id,
            @RequestParam(defaultValue = "20") int size) {
        
        IncidentStatus statusEnum = status != null ? IncidentStatus.valueOf(status.toUpperCase()) : null;
        IncidentSeverity severityEnum = severity != null ? IncidentSeverity.valueOf(severity.toUpperCase()) : null;
        
        return incidentService.getIncidents(statusEnum, severityEnum, before_id, size).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public IncidentDTO getIncident(@PathVariable Long id) {
        return convertToDTO(incidentService.getIncident(id));
    }

    @PatchMapping("/{id}")
    public IncidentDTO updateIncident(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Incident incident = incidentService.getIncident(id);

        if (body.containsKey("status")) {
            String resolutionNotes = (String) body.get("resolutionNotes");
            incidentService.updateStatus(id, IncidentStatus.valueOf((String) body.get("status")), resolutionNotes);
        }

        if (body.containsKey("severity")) {
            incidentService.updateSeverity(id, IncidentSeverity.valueOf((String) body.get("severity")));
        }

        if (body.containsKey("ownerId")) {
            Object ownerIdObj = body.get("ownerId");
            if (ownerIdObj != null) {
                userRepository.findById(Long.valueOf(ownerIdObj.toString()))
                        .ifPresent(user -> incidentService.assignOwner(id, user));
            } else {
                incidentService.assignOwner(id, null);
            }
        }

        return convertToDTO(incidentService.getIncident(id));
    }

    @GetMapping("/{id}/timeline")
    public Page<IncidentTimelineEntry> getTimeline(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return timelineRepository.findByIncidentIdOrderByCreatedAtDesc(id, PageRequest.of(page, size));
    }

    @PostMapping("/{id}/attachments")
    public IncidentAttachment addAttachment(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Incident incident = incidentService.getIncident(id);
        
        IncidentAttachment attachment = IncidentAttachment.builder()
                .incident(incident)
                .type((String) body.get("type"))
                .referenceId((String) body.get("referenceId"))
                .snapshot((Map<String, Object>) body.get("snapshot"))
                .build();
                
        return attachmentRepository.save(attachment);
    }

    private IncidentDTO convertToDTO(Incident incident) {
        return IncidentDTO.builder()
                .id(incident.getId())
                .title(incident.getTitle()) // Wait, DTO has alertName, summary, etc. I'll map title to summary.
                .summary(incident.getTitle())
                .description(incident.getTitle()) // Title as description if missing
                .aiSummary(incident.getAiSummary())
                .severity(incident.getSeverity().name())
                .status(incident.getStatus().name())
                .ownerId(incident.getOwner() != null ? incident.getOwner().getId() : null)
                .ownerName(incident.getOwner() != null ? incident.getOwner().getUsername() : null)
                .createdAt(incident.getCreatedAt())
                .resolvedAt(incident.getResolvedAt())
                .resolutionNotes(incident.getResolutionNotes())
                .applicationId(incident.getApplication() != null ? incident.getApplication().getId() : null)
                .applicationName(incident.getApplication() != null ? incident.getApplication().getName() : null)
                .ticketId(incident.getLinkedTicket() != null ? incident.getLinkedTicket().getId() : null)
                .build();
    }
}
