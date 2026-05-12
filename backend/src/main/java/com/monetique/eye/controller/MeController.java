package com.monetique.eye.controller;

import com.monetique.eye.dto.UserPermissionDto;
import com.monetique.eye.entity.ClusterAccess;
import com.monetique.eye.entity.User;
import com.monetique.eye.entity.UserPermissionDetail;
import com.monetique.eye.repository.ClusterAccessRepository;
import com.monetique.eye.repository.UserPermissionDetailRepository;
import com.monetique.eye.service.SecurityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/me")
@RequiredArgsConstructor
public class MeController {

    private final UserPermissionDetailRepository userPermissionDetailRepository;
    private final ClusterAccessRepository clusterAccessRepository;
    private final SecurityService securityService;

    @GetMapping("/permissions")
    public ResponseEntity<UserPermissionDto> getMyPermissions() {
        User user = securityService.getCurrentUser();
        if (user == null) return ResponseEntity.status(401).build();

        String userId = user.getUsername();
        
        UserPermissionDetail detail = userPermissionDetailRepository.findByUserId(userId)
                .orElse(UserPermissionDetail.builder().userId(userId).build());
        
        List<String> allowedClusters = clusterAccessRepository.findByUserId(userId).stream()
                .map(ClusterAccess::getClusterId)
                .collect(Collectors.toList());

        return ResponseEntity.ok(mapToDto(userId, detail, allowedClusters));
    }

    private UserPermissionDto mapToDto(String userId, UserPermissionDetail detail, List<String> allowedClusters) {
        return UserPermissionDto.builder()
                .userId(userId)
                .clusterAccess(detail.isClusterAccess())
                .allowedClusterIds(allowedClusters)
                .monitoring(UserPermissionDto.MonitoringPermissions.builder()
                        .observability(detail.isMonitoringObservability())
                        .logs(detail.isMonitoringLogs())
                        .infraGraph(detail.isMonitoringInfraGraph())
                        .build())
                .envDeployment(UserPermissionDto.DeploymentPermissions.builder()
                        .view(detail.isEnvDeploymentView())
                        .create(detail.isEnvDeploymentCreate())
                        .edit(detail.isEnvDeploymentEdit())
                        .delete(detail.isEnvDeploymentDelete())
                        .build())
                .appDeployment(UserPermissionDto.DeploymentPermissions.builder()
                        .view(detail.isAppDeploymentView())
                        .create(detail.isAppDeploymentCreate())
                        .edit(detail.isAppDeploymentEdit())
                        .delete(detail.isAppDeploymentDelete())
                        .build())
                .incidents(UserPermissionDto.IncidentPermissions.builder()
                        .view(detail.isIncidentsView())
                        .create(detail.isIncidentsCreate())
                        .edit(detail.isIncidentsEdit())
                        .delete(detail.isIncidentsDelete())
                        .build())
                .chatbotAccess(detail.isChatbotAccess())
                .build();
    }
}
