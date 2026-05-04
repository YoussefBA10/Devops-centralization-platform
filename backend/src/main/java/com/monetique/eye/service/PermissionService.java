package com.monetique.eye.service;

import com.monetique.eye.entity.ClusterAccess;
import com.monetique.eye.entity.User;
import com.monetique.eye.entity.UserPermissionDetail;
import com.monetique.eye.entity.enums.Role;
import com.monetique.eye.repository.ClusterAccessRepository;
import com.monetique.eye.repository.UserPermissionDetailRepository;
import com.monetique.eye.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PermissionService {

    private final UserPermissionDetailRepository permissionDetailRepository;
    private final ClusterAccessRepository clusterAccessRepository;
    private final UserRepository userRepository;

    public UserPermissionDetail getPermissions(String userId) {
        return permissionDetailRepository.findByUserId(userId)
                .orElse(UserPermissionDetail.builder().userId(userId).build());
    }

    public List<String> getAllowedClusterIds(String userId) {
        return clusterAccessRepository.findByUserId(userId)
                .stream()
                .map(ClusterAccess::getClusterId)
                .collect(Collectors.toList());
    }

    public boolean hasClusterAccess(String userId, String clusterId) {
        if (isAdmin(userId)) return true;
        return clusterAccessRepository.existsByUserIdAndClusterId(userId, clusterId);
    }

    public boolean can(String userId, String permission) {
        if (isAdmin(userId)) return true;

        UserPermissionDetail detail = getPermissions(userId);
        return switch (permission) {
            case "CLUSTER_ACCESS" -> detail.isClusterAccess();
            case "MONITORING_OBSERVABILITY" -> detail.isMonitoringObservability();
            case "MONITORING_LOGS" -> detail.isMonitoringLogs();
            case "MONITORING_INFRA_GRAPH" -> detail.isMonitoringInfraGraph();
            case "ENV_DEPLOYMENT_VIEW" -> detail.isEnvDeploymentView();
            case "ENV_DEPLOYMENT_CREATE" -> detail.isEnvDeploymentCreate();
            case "ENV_DEPLOYMENT_EDIT" -> detail.isEnvDeploymentEdit();
            case "ENV_DEPLOYMENT_DELETE" -> detail.isEnvDeploymentDelete();
            case "APP_DEPLOYMENT_VIEW" -> detail.isAppDeploymentView();
            case "APP_DEPLOYMENT_CREATE" -> detail.isAppDeploymentCreate();
            case "APP_DEPLOYMENT_EDIT" -> detail.isAppDeploymentEdit();
            case "APP_DEPLOYMENT_DELETE" -> detail.isAppDeploymentDelete();
            case "INCIDENTS_VIEW" -> detail.isIncidentsView();
            case "INCIDENTS_CREATE" -> detail.isIncidentsCreate();
            case "INCIDENTS_EDIT" -> detail.isIncidentsEdit();
            case "INCIDENTS_DELETE" -> detail.isIncidentsDelete();
            case "CHATBOT_ACCESS" -> detail.isChatbotAccess();
            default -> false;
        };
    }

    private boolean isAdmin(String userId) {
        return userRepository.findByUsername(userId)
                .map(user -> user.getRole() == Role.ADMIN)
                .orElse(false);
    }
}
