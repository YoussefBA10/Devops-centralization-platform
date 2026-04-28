package com.monetique.eye.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StabilityResponse {
    private double avgStability;
    private double trend; // e.g., 1.2 for +1.2%
    private int totalEnvironments;
    private int activeAgents;
    private double networkLoad; // In Mbps
    private LocalDateTime calculationTimestamp;
}
