package com.monetique.eye.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "managed_nodes", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"environment_id", "ip"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ManagedNode {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String ip;

    private String nodeName;

    @Column(nullable = false)
    private String sshUser;

    @Column(nullable = false)
    private String sshPassword;

    private String role; // e.g., app, db, proxy

    @Column(name = "node_exporter_port")
    @Builder.Default
    private Integer nodeExporterPort = 9100;

    @Column(name = "cadvisor_port")
    @Builder.Default
    private Integer cadvisorPort = 8080;

    @Column(name = "app_metrics_port")
    private Integer appMetricsPort;

    @Column(name = "app_metrics_path")
    @Builder.Default
    private String appMetricsPath = "/metrics";

    private String appName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "environment_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @JsonIgnore
    private Environment environment;
}
