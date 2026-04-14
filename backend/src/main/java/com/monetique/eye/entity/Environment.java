package com.monetique.eye.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.monetique.eye.entity.enums.DeploymentStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "environments")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Environment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    private String description;
    private String prometheusLabel;
    private String centralNodeIp;

    @Enumerated(EnumType.STRING)
    private DeploymentStatus lastDeploymentStatus;

    private LocalDateTime lastDeployedAt;
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "environment", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    @JsonIgnore
    private Set<Application> applications = new HashSet<>();

    @OneToMany(mappedBy = "environment", cascade = CascadeType.ALL)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    @JsonIgnore
    private Set<Ticket> tickets = new HashSet<>();

    @OneToMany(mappedBy = "environment")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    @JsonIgnore
    private Set<DeploymentLog> deploymentLogs = new HashSet<>();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
