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
public class AlertGroupDTO {
    private Long id;
    private String fingerprint;
    private String name;
    private String status;
    private String severity;
    private LocalDateTime firstFiredAt;
    private LocalDateTime lastFiredAt;
    private Long incidentId;
}
