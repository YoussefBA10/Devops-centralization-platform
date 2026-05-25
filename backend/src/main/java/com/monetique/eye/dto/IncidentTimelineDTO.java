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
public class IncidentTimelineDTO {
    private Long id;
    private String action;
    private String actorName;
    private Map<String, Object> payload;
    private LocalDateTime createdAt;
}
