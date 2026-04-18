package com.monetique.eye.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "applications")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Application {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "environment_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @JsonIgnore
    private Environment environment;

    @Column(nullable = false)
    private String name;

    private String serviceNameKeyword;

    private String type; // BACKEND, FRONTEND, FULLSTACK
    
    private String appLanguage; // e.g. Java Spring Boot, Node.js

    private String repoUrl;

    private String targetNode;

    private String branch;

    private Integer port;

    private String status; // RUNNING, DEPLOYING, FAILED

    private java.time.LocalDateTime lastDeployedAt;
    
    private String srcPath;
    
    private String extraHosts;
    
    @Column(columnDefinition = "TEXT")
    private String envVarsJson;



    private java.time.LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = java.time.LocalDateTime.now();
        if (status == null) status = "DEPLOYING";
    }

    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private java.util.List<Ticket> tickets = new java.util.ArrayList<>();

    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private java.util.List<RecurringPattern> recurringPatterns = new java.util.ArrayList<>();

    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private java.util.List<LogAggregationWindow> logAggregationWindows = new java.util.ArrayList<>();

    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private java.util.List<Incident> incidents = new java.util.ArrayList<>();

    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private java.util.List<Conversation> conversations = new java.util.ArrayList<>();

    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private java.util.List<AiOperationalSummary> aiOperationalSummaries = new java.util.ArrayList<>();
}
