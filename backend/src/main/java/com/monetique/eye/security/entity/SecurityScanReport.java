package com.monetique.eye.security.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.monetique.eye.entity.Application;
import com.monetique.eye.security.entity.enums.ReportComponent;
import com.monetique.eye.security.entity.enums.ReportType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "security_scan_reports")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SecurityScanReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Application application;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReportType reportType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReportComponent component;

    private String buildNumber;

    @Basic(fetch = FetchType.LAZY)
    @Column(columnDefinition = "LONGTEXT")
    @ToString.Exclude
    @JsonIgnore
    private String rawJson;

    private Integer criticalCount;
    private Integer highCount;
    private Integer mediumCount;
    private Integer lowCount;
    private Integer totalIssues;

    private LocalDateTime uploadedAt;

    @PrePersist
    protected void onCreate() {
        if (uploadedAt == null) {
            uploadedAt = LocalDateTime.now();
        }
    }
}
