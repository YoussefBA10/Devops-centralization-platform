package com.monetique.eye.security.dto;

/** Lightweight read projection for latest report severity counts — never loads raw_json. */
public interface ReportCountProjection {
    Long getId();
    Integer getCriticalCount();
    Integer getHighCount();
    Integer getMediumCount();
    Integer getLowCount();
}
