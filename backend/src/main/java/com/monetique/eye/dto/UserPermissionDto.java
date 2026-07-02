package com.monetique.eye.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserPermissionDto {
    private String userId;
    private boolean clusterAccess;
    private List<String> allowedClusterIds;
    private MonitoringPermissions monitoring;
    private DeploymentPermissions envDeployment;
    private DeploymentPermissions appDeployment;
    private IncidentPermissions incidents;
    private boolean chatbotAccess;
    private boolean networkMonitorView;
    private boolean securityDashboardView;
    private boolean analyseView;
    private boolean auditLogView;
    private boolean documentationView;
    private boolean operationalIntelligenceView;
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MonitoringPermissions {
        private boolean observability;
        private boolean logs;
        private boolean infraGraph;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DeploymentPermissions {
        private boolean view;
        private boolean create;
        private boolean edit;
        private boolean delete;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class IncidentPermissions {
        private boolean view;
        private boolean create;
        private boolean edit;
        private boolean delete;
    }
}
