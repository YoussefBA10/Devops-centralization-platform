package com.monetique.eye.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

@Entity
@Table(name = "deployment_event")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeploymentEvent {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    @Column(updatable = false, nullable = false, length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "app_id", nullable = false)
    private Application application;

    @Column(nullable = false, length = 20)
    private String env;

    @Column(nullable = false, length = 100)
    private String version;

    @Column(name = "build_number", length = 20)
    private String buildNumber;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "started_at", updatable = false)
    private LocalDateTime startedAt;

    @PrePersist
    protected void onCreate() {
        if (startedAt == null) {
            startedAt = LocalDateTime.now();
        }
    }
}
