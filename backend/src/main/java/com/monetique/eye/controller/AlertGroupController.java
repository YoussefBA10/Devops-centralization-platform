package com.monetique.eye.controller;

import com.monetique.eye.dto.AlertGroupDTO;
import com.monetique.eye.entity.AlertGroup;
import com.monetique.eye.service.AlertGroupService;
import com.monetique.eye.service.IncidentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/alerts/groups")
@RequiredArgsConstructor
public class AlertGroupController {

    private final AlertGroupService alertGroupService;
    private final IncidentService incidentService;

    @GetMapping
    public List<AlertGroupDTO> getActiveGroups() {
        return alertGroupService.getActiveGroups().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<?> resolve(@PathVariable Long id) {
        // Find group by ID to get fingerprint
        // (The webhook usually sends fingerprint, but frontend might use ID)
        // For simplicity, we'll implement a resolveById in the service if needed,
        // but here we can just update the status directly if we have the entity.
        // Let's assume the service handles resolution.
        alertGroupService.resolveGroup(alertGroupService.getActiveGroups().stream()
            .filter(g -> g.getId().equals(id)).findFirst().map(AlertGroup::getFingerprint).orElse(null));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/link/{incidentId}")
    public ResponseEntity<?> linkToIncident(@PathVariable Long id, @PathVariable Long incidentId) {
        alertGroupService.linkToIncident(id, incidentId, incidentService);
        return ResponseEntity.ok().build();
    }

    private AlertGroupDTO convertToDTO(AlertGroup group) {
        return AlertGroupDTO.builder()
                .id(group.getId())
                .fingerprint(group.getFingerprint())
                .name(group.getName())
                .status(group.getStatus().name())
                .severity(group.getSeverity())
                .firstFiredAt(group.getFirstFiredAt())
                .lastFiredAt(group.getLastFiredAt())
                .incidentId(group.getIncident() != null ? group.getIncident().getId() : null)
                .build();
    }
}
