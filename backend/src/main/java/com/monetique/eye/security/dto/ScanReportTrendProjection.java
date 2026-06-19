package com.monetique.eye.security.dto;

import com.monetique.eye.security.entity.enums.ReportComponent;
import com.monetique.eye.security.entity.enums.ReportType;

import java.time.LocalDateTime;

/** Lightweight read projection — never loads raw_json. */
public interface ScanReportTrendProjection {
    Long getApplicationId();
    LocalDateTime getUploadedAt();
    ReportType getReportType();
    ReportComponent getComponent();
    String getBuildNumber();
    Integer getCriticalCount();
    Integer getHighCount();
    Integer getMediumCount();
    Integer getLowCount();
    Integer getTotalIssues();
    String getApplicationName();
}
