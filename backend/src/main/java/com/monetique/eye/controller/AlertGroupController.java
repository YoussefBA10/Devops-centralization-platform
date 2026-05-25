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
@RequestMapping("/api/v1/alerts/groups")
@RequiredArgsConstructor
public class AlertGroupController {

    private final AlertGroupService alertGroupService;
    // Removed IncidentService as incidents are phased out

    @GetMapping
    public List<AlertGroupDTO> getActiveGroups() {
        return alertGroupService.getActiveGroups().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<?> resolve(@PathVariable Long id) {
        alertGroupService.resolveGroup(alertGroupService.getActiveGroups().stream()
            .filter(g -> g.getId().equals(id)).findFirst().map(AlertGroup::getFingerprint).orElse(null));
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
                .ticketId(group.getTicket() != null ? group.getTicket().getId() : null)
                .build();
    }
}
