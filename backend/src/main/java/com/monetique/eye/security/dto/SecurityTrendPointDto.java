package com.monetique.eye.security.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.monetique.eye.security.entity.enums.ReportComponent;
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
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime date;
    private Long applicationId;
    private ReportType reportType;
    private ReportComponent component;
    private String buildNumber;
    private int criticalCount;
    private int highCount;
    private int mediumCount;
    private int lowCount;
    private int totalIssues;
    private String applicationName;
}
