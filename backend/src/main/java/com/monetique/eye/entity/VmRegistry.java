package com.monetique.eye.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "vm_registry")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VmRegistry {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    @Column(updatable = false, nullable = false, length = 36)
    private String id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "ip_address", nullable = false, length = 45)
    private String ipAddress;

    @Column(nullable = false, length = 50)
    private String role;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cluster_id", nullable = false)
    private Cluster cluster;

    @Column(nullable = false, length = 20)
    private String env;

    @Column(name = "node_exporter_port", nullable = false)
    @Builder.Default
    private Integer nodeExporterPort = 9100;

    @Column(name = "cadvisor_port", nullable = false)
    @Builder.Default
    private Integer cadvisorPort = 8080;

    @Column(name = "app_metrics_port")
    private Integer appMetricsPort;

    @Column(name = "app_metrics_path", length = 200)
    @Builder.Default
    private String appMetricsPath = "/metrics";

    @Column(name = "app_name", length = 100)
    private String appName;

    @Column(name = "netstat_collector_confirmed")
    @Builder.Default
    private Boolean netstatCollectorConfirmed = false;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
