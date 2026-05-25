package com.monetique.eye.controller;

import com.monetique.eye.dto.UserPermissionDto;
import com.monetique.eye.entity.Cluster;
import com.monetique.eye.entity.Environment;
import com.monetique.eye.entity.ClusterAccess;
import com.monetique.eye.entity.User;
import com.monetique.eye.entity.UserPermission;
import com.monetique.eye.entity.UserPermissionDetail;
import com.monetique.eye.entity.enums.Role;
import com.monetique.eye.repository.ClusterAccessRepository;
import com.monetique.eye.repository.ClusterRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.repository.UserPermissionDetailRepository;
import com.monetique.eye.repository.UserPermissionRepository;
import com.monetique.eye.repository.UserRepository;
import com.monetique.eye.service.SecurityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin/permissions")
@RequiredArgsConstructor
public class AdminPermissionController {

    private final UserRepository userRepository;
    private final EnvironmentRepository environmentRepository;
    private final UserPermissionRepository userPermissionRepository;
    private final UserPermissionDetailRepository userPermissionDetailRepository;
    private final ClusterAccessRepository clusterAccessRepository;
    private final ClusterRepository clusterRepository;
    private final SecurityService securityService;
    private final com.monetique.eye.service.NotificationService notificationService;

    @GetMapping("/me")
    public ResponseEntity<UserPermissionDto> getMyPermissions() {
        User user = securityService.getCurrentUser();
        if (user == null) return ResponseEntity.status(401).build();
        String userId = user.getUsername();
        
        if (user.getRole() == Role.ADMIN) {
            return ResponseEntity.ok(getFullPermissionsDto(userId));
        }
        
        UserPermissionDetail detail = userPermissionDetailRepository.findByUserId(userId).orElse(null);
        List<String> allowedClusters = clusterAccessRepository.findByUserId(userId).stream()
                .map(ClusterAccess::getClusterId)
                .collect(Collectors.toList());

        if (detail == null) {
            return ResponseEntity.ok(UserPermissionDto.builder()
                    .userId(userId)
                    .allowedClusterIds(allowedClusters)
                    .monitoring(UserPermissionDto.MonitoringPermissions.builder().build())
                    .envDeployment(UserPermissionDto.DeploymentPermissions.builder().build())
                    .appDeployment(UserPermissionDto.DeploymentPermissions.builder().build())
                    .incidents(UserPermissionDto.IncidentPermissions.builder().build())
                    .build());
        }

        return ResponseEntity.ok(mapToDto(userId, detail, allowedClusters));
    }

    @GetMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Map<String, Object>> getUsers() {
        return userRepository.findAll().stream()
                .filter(user -> user.getRole() == Role.USER)
                .map(user -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", user.getId());
                    m.put("username", user.getUsername());
                    return m;
                })
                .collect(Collectors.toList());
    }

    @GetMapping("/clusters")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Map<String, Object>> getClusters() {
        return clusterRepository.findAll().stream()
                .map(cluster -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", cluster.getId());
                    m.put("name", cluster.getName());
                    return m;
                })
                .collect(Collectors.toList());
    }

    @GetMapping("/environments")
    @PreAuthorize("hasRole('ADMIN')")
    @Deprecated
    public List<Map<String, Object>> getEnvironments() {
        return getClusters(); // Temporary fallback
    }

    @GetMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserPermissionDto> getPermissions(@PathVariable String userId) {
        UserPermissionDetail detail = userPermissionDetailRepository.findByUserId(userId)
                .orElse(null);
        
        List<String> allowedClusters = clusterAccessRepository.findByUserId(userId).stream()
                .map(ClusterAccess::getClusterId)
                .collect(Collectors.toList());

        if (detail == null) {
            // Return a default DTO with everything false
            return ResponseEntity.ok(UserPermissionDto.builder()
                    .userId(userId)
                    .allowedClusterIds(allowedClusters)
                    .monitoring(UserPermissionDto.MonitoringPermissions.builder().build())
                    .envDeployment(UserPermissionDto.DeploymentPermissions.builder().build())
                    .appDeployment(UserPermissionDto.DeploymentPermissions.builder().build())
                    .incidents(UserPermissionDto.IncidentPermissions.builder().build())
                    .build());
        }

        return ResponseEntity.ok(mapToDto(userId, detail, allowedClusters));
    }

    @PutMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<UserPermissionDto> updatePermissions(@PathVariable String userId, @RequestBody UserPermissionDto dto) {
        User admin = securityService.getCurrentUser();
        
        // 1. Update UserPermission metadata
        UserPermission permission = userPermissionRepository.findByUserId(userId)
                .orElse(UserPermission.builder().userId(userId).build());
        permission.setGrantedByAdminId(admin.getUsername());
        userPermissionRepository.save(permission);

        // 2. Update UserPermissionDetail
        UserPermissionDetail detail = userPermissionDetailRepository.findByUserId(userId)
                .orElse(UserPermissionDetail.builder().userId(userId).build());
        
        detail.setClusterAccess(dto.isClusterAccess());
        detail.setMonitoringObservability(dto.getMonitoring().isObservability());
        detail.setMonitoringLogs(dto.getMonitoring().isLogs());
        detail.setMonitoringInfraGraph(dto.getMonitoring().isInfraGraph());

        detail.setEnvDeploymentView(dto.getEnvDeployment().isView());
        detail.setEnvDeploymentCreate(dto.getEnvDeployment().isCreate());
        detail.setEnvDeploymentEdit(dto.getEnvDeployment().isEdit());
        detail.setEnvDeploymentDelete(dto.getEnvDeployment().isDelete());

        detail.setAppDeploymentView(dto.getAppDeployment().isView());
        detail.setAppDeploymentCreate(dto.getAppDeployment().isCreate());
        detail.setAppDeploymentEdit(dto.getAppDeployment().isEdit());
        detail.setAppDeploymentDelete(dto.getAppDeployment().isDelete());

        detail.setIncidentsView(dto.getIncidents().isView());
        detail.setIncidentsCreate(dto.getIncidents().isCreate());
        detail.setIncidentsEdit(dto.getIncidents().isEdit());
        detail.setIncidentsDelete(dto.getIncidents().isDelete());

        detail.setChatbotAccess(dto.isChatbotAccess());
        
        userPermissionDetailRepository.save(detail);

        // 3. Update Cluster Access
        clusterAccessRepository.deleteByUserId(userId);
        List<ClusterAccess> accesses = dto.getAllowedClusterIds().stream()
                .map(clusterId -> ClusterAccess.builder()
                        .userId(userId)
                        .clusterId(clusterId)
                        .build())
                .collect(Collectors.toList());
        clusterAccessRepository.saveAll(accesses);

        // 4. Notify User
        notificationService.createNotification(
                userId,
                "Permissions Updated",
                "Your system privileges have been updated by an administrator.",
                "PERMISSION_CHANGE"
        );

        return ResponseEntity.ok(dto);
    }

    @DeleteMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Map<String, String>> revokePermissions(@PathVariable String userId) {
        userPermissionRepository.deleteByUserId(userId);
        userPermissionDetailRepository.deleteByUserId(userId);
        clusterAccessRepository.deleteByUserId(userId);
        return ResponseEntity.ok(Map.of("message", "All permissions revoked for user " + userId));
    }

    private UserPermissionDto getFullPermissionsDto(String userId) {
        return UserPermissionDto.builder()
                .userId(userId)
                .clusterAccess(true)
                .allowedClusterIds(clusterRepository.findAll().stream().map(c -> c.getId().toString()).collect(Collectors.toList()))
                .monitoring(new UserPermissionDto.MonitoringPermissions(true, true, true))
                .envDeployment(new UserPermissionDto.DeploymentPermissions(true, true, true, true))
                .appDeployment(new UserPermissionDto.DeploymentPermissions(true, true, true, true))
                .incidents(new UserPermissionDto.IncidentPermissions(true, true, true, true))
                .chatbotAccess(true)
                .build();
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
