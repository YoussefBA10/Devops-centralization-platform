package com.monetique.eye.security.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SecurityDashboardSummaryDto {
    private Long applicationId;
    private String applicationName;
    private LocalDateTime latestDependencyScan;
    private LocalDateTime latestSonarScan;
    
    private int criticalCount;
    private int highCount;
    private int mediumCount;
    private int lowCount;
    
    private String trend;
    
    private int falcoEventsLast24h;
}
