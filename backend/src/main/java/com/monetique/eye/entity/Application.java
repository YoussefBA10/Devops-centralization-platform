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

    private java.time.LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = java.time.LocalDateTime.now();
        if (status == null) status = "DEPLOYING";
    }
}
