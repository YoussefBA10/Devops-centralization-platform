package com.monetique.eye.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

@Entity
@Table(name = "network_alert_rule")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NetworkAlertRule {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    @Column(updatable = false, nullable = false, length = 36)
    private String id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "rule_type", nullable = false, length = 50)
    private String ruleType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "link_id")
    private ServiceLink link;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "node_id")
    private ManagedNode node;

    @Column(name = "threshold_value", nullable = false)
    private Double thresholdValue;

    @Column(name = "threshold_unit", length = 20)
    private String thresholdUnit;

    @Column(length = 20)
    @Builder.Default
    private String severity = "WARNING";

    @Builder.Default
    private Boolean enabled = true;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
