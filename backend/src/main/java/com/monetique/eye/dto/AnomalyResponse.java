package com.monetique.eye.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnomalyResponse {
    private String description;
    private String node;
    private LocalDateTime timestamp;
    private String severity; // CRITICAL, WARNING, INFO
    private String type; // RESOURCE, LOG, RESTART
}
