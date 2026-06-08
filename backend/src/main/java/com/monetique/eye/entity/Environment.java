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
@com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Environment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    @Builder.Default
    private Long version = 0L;

    @Column(nullable = false, unique = true)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cluster_id")
    private Cluster cluster;

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

    @OneToMany(mappedBy = "environment", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    @JsonIgnore
    private Set<Ticket> tickets = new HashSet<>();

    @OneToMany(mappedBy = "environment", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    @JsonIgnore
    private Set<DeploymentLog> deploymentLogs = new HashSet<>();

    @OneToMany(mappedBy = "environment", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    @JsonIgnore
    private Set<ManagedNode> managedNodes = new HashSet<>();

    @ManyToMany(mappedBy = "environments")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    @JsonIgnore
    private Set<User> users = new HashSet<>();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    @PostLoad
    protected void onPostLoad() {
        if (version == null) version = 0L;
    }

    public String getSafeName() {
        if (name == null) return "unknown";
        return name.toLowerCase().replaceAll("[^a-z0-9]", "-").replaceAll("-+", "-").replaceAll("^-|-$", "");
    }
}
