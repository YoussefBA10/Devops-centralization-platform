package com.monetique.eye.security.dto;

import com.monetique.eye.security.entity.enums.ReportType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SecurityTrendPointDto {
    private LocalDateTime date;
    private ReportType reportType;
    private String buildNumber;
    private int criticalCount;
    private int highCount;
    private int mediumCount;
    private int lowCount;
    private int totalIssues;
}
