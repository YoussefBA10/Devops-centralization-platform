package com.monetique.eye.security.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SecurityReportUploadResponse {
    private Long id;
    private Integer parsedIssueCount;
    private Integer criticalCount;
    private Integer highCount;
}
