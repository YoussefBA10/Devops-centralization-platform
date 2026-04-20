package com.monetique.eye.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "deployment_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeploymentLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "environment_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Environment environment;

    private String action;
    private String targetIp;
    private String appName;
    private String status;
    
    private String shortError;
    
    @Column(columnDefinition = "TEXT")
    private String logOutput;

    @ManyToOne
    private User executedBy;

    private LocalDateTime executedAt;

    @PrePersist
    protected void onExecute() {
        executedAt = LocalDateTime.now();
    }
}
