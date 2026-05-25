package com.monetique.eye.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IncidentDTO {
    // Existing alert-related fields
    private String alertName;
    private String severity;
    private String summary;
    private String description;
    private String instance;
    private String state;
    private LocalDateTime activeAt;
    private Map<String, String> labels;

    // New incident management fields
    private Long id;
    private String title;
    private String status;
    private String ownerName;
    private Long ownerId;
    private LocalDateTime createdAt;
    private LocalDateTime resolvedAt;
    private String resolutionNotes;
    private Long applicationId;
    private String applicationName;
    private Long ticketId;
    private String aiSummary;
}
