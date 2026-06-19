package com.monetique.eye.security.dto;

import com.monetique.eye.security.entity.enums.ReportType;

import java.time.LocalDateTime;

/** Lightweight read projection — never loads raw_json. */
public interface ScanReportTrendProjection {
    LocalDateTime getUploadedAt();
    ReportType getReportType();
    String getBuildNumber();
    Integer getCriticalCount();
    Integer getHighCount();
    Integer getMediumCount();
    Integer getLowCount();
    Integer getTotalIssues();
    String getApplicationName();
}
