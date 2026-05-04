package com.monetique.eye.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "user_permission_details")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserPermissionDetail {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String userId;

    private boolean clusterAccess;

    // Monitoring
    private boolean monitoringObservability;
    private boolean monitoringLogs;
    private boolean monitoringInfraGraph;

    // Env Deployment
    private boolean envDeploymentView;
    private boolean envDeploymentCreate;
    private boolean envDeploymentEdit;
    private boolean envDeploymentDelete;

    // App Deployment
    private boolean appDeploymentView;
    private boolean appDeploymentCreate;
    private boolean appDeploymentEdit;
    private boolean appDeploymentDelete;

    // Incidents / Tickets
    private boolean incidentsView;
    private boolean incidentsCreate;
    private boolean incidentsEdit;
    private boolean incidentsDelete;

    // Chatbot
    private boolean chatbotAccess;
}
