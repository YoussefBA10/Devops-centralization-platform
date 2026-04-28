package com.monetique.eye.controller;

import com.monetique.eye.dto.ApplicationDTO;
import com.monetique.eye.dto.DeployRequestDTO;
import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.Environment;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.DeploymentLogRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.service.DeploymentService;
import com.monetique.eye.security.RequiresPermission;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/applications")
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationRepository applicationRepository;
    private final EnvironmentRepository environmentRepository;
    private final DeploymentService deploymentService;
    private final DeploymentLogRepository deploymentLogRepository;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    private final com.monetique.eye.service.ActivityLogService activityLogService;

    @GetMapping
    @RequiresPermission("APP_DEPLOYMENT_VIEW")
    public ResponseEntity<List<ApplicationDTO>> getApplications(@RequestParam Long environmentId) {
        List<Application> apps = applicationRepository.findByEnvironmentId(environmentId);
        List<ApplicationDTO> dtos = apps.stream().map(app -> ApplicationDTO.builder()
                .id(app.getId())
                .name(app.getName())
                .type(app.getType())
                .appLanguage(app.getAppLanguage())
                .repoUrl(app.getRepoUrl())
                .targetNode(app.getTargetNode())
                .branch(app.getBranch())
                .port(app.getPort())
                .status(app.getStatus())
                .lastDeployedAt(app.getLastDeployedAt())
                .createdAt(app.getCreatedAt())
                .environmentId(app.getEnvironment().getId())
                .srcPath(app.getSrcPath())
                .containerPort(app.getContainerPort())
                .isCanary(app.getIsCanary())
                .canaryPort(app.getCanaryPort())
                .lastErrorMessage(app.getLastErrorMessage())
                .gitToken(app.getGitToken())
                .envVars(parseEnvVars(app.getEnvVarsJson()))
                .build()).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @PostMapping("/deploy")
    @RequiresPermission("APP_DEPLOYMENT_CREATE")
    public ResponseEntity<?> deployApplication(@RequestBody DeployRequestDTO request, org.springframework.security.core.Authentication authentication) {
        Environment env = environmentRepository.findById(request.getEnvironmentId())
                .orElseThrow(() -> new RuntimeException("Environment not found"));

        Application app;
        String previousName = "";
        if (request.getId() != null) {
            // Update existing app
            app = applicationRepository.findById(request.getId())
                .orElseThrow(() -> new RuntimeException("Application with ID " + request.getId() + " not found"));
            
            previousName = app.getName();
            request.setAutoPromote(true);
            
            // Check if name is being changed and if new name conflicts
            if (!previousName.equalsIgnoreCase(request.getName())) {
                if (applicationRepository.findByNameIgnoreCaseAndEnvironmentId(request.getName(), request.getEnvironmentId()).isPresent()) {
                    return ResponseEntity.status(409).body(Map.of("message", "An application with name '" + request.getName() + "' already exists in this environment."));
                }
            }
        } else {
            // Create new app
            if (applicationRepository.findByNameIgnoreCaseAndEnvironmentId(request.getName(), request.getEnvironmentId()).isPresent()) {
                return ResponseEntity.status(409).body(Map.of("message", "Application with name '" + request.getName() + "' already exists. Choose a different name or edit the existing one."));
            }
            app = Application.builder()
                    .name(request.getName())
                    .environment(env)
                    .serviceNameKeyword(request.getName().toLowerCase())
                    .build();
        }

        app.setName(request.getName()); // Just in case it was a rename
        app.setServiceNameKeyword(request.getName().toLowerCase());

        app.setType(request.getType());
        app.setAppLanguage(request.getAppLanguage());
        app.setRepoUrl(request.getRepoUrl());
        app.setTargetNode(request.getTargetNode());
        app.setBranch(request.getBranch());
        app.setPort(request.getPort());
        app.setSrcPath(request.getSrcPath());

        // Port conflict validation: Check if another application uses the same port on the same node
        List<Application> conflictingApps = applicationRepository.findByEnvironmentIdAndTargetNodeAndPort(
                request.getEnvironmentId(), request.getTargetNode(), request.getPort());
        
        java.util.Optional<Application> realConflict = conflictingApps.stream()
                .filter(a -> request.getId() == null || !a.getId().equals(request.getId()))
                .findFirst();
        
        if (realConflict.isPresent()) {
            return ResponseEntity.status(409).body(Map.of("message", 
                "Port " + request.getPort() + " is already occupied by application '" + realConflict.get().getName() + "' on this node."));
        }
        
        // Handle Container Port Defaulting
        if (request.getContainerPort() != null) {
            app.setContainerPort(request.getContainerPort());
        } else {
            // Default based on type
            if ("FRONTEND".equalsIgnoreCase(request.getType())) {
                app.setContainerPort(80);
            } else {
                app.setContainerPort(request.getPort() != null ? request.getPort() : 8080);
            }
        }

        if (request.getAlreadyDeployed() != null && request.getAlreadyDeployed()) {
            app.setStatus("RUNNING");
            // Important: set serviceNameKeyword so it can be matched in monitoring/operations
            app.setServiceNameKeyword(app.getName());
            applicationRepository.save(app);
            activityLogService.logActivity("Application Registered (Already Deployed): " + app.getName(), "deployment", env.getName());
            return ResponseEntity.ok(Map.of("message", "Application registered successfully", "appId", app.getId()));
        }

        app.setStatus("DEPLOYING");
        app.setLastDeployedAt(LocalDateTime.now());
        app.setGitToken(request.getGitToken());
        if (request.getEnvVars() != null) {
            try {
                app.setEnvVarsJson(objectMapper.writeValueAsString(request.getEnvVars()));
            } catch (Exception e) {
                // Log error but continue
            }
        }

        applicationRepository.save(app);

        // Async deployment
        deploymentService.deployApplicationFull(env.getId(), request, app.getId(), previousName, authentication.getName());

        activityLogService.logActivity("Deployment Started: " + app.getName(), "deployment", env.getName());
        return ResponseEntity.ok(Map.of("message", "Deployment triggered successfully", "appId", app.getId()));
    }

    /** Poll live status of an application (for frontend polling while DEPLOYING). */
    @GetMapping("/{id}/status")
    @RequiresPermission("APP_DEPLOYMENT_VIEW")
    public ResponseEntity<?> getApplicationStatus(@PathVariable Long id) {
        Application app = applicationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Application not found"));
        return ResponseEntity.ok(Map.of(
                "id", app.getId(),
                "status", app.getStatus() != null ? app.getStatus() : "UNKNOWN",
                "lastDeployedAt", app.getLastDeployedAt() != null ? app.getLastDeployedAt().toString() : ""
        ));
    }

    /**
     * Fetch the full Ansible log output from the last deployment of this application.
     * This enables the frontend to surface the exact Ansible/SSH error when deployment fails.
     */
    @GetMapping("/{id}/logs")
    @RequiresPermission("APP_DEPLOYMENT_VIEW")
    public ResponseEntity<?> getApplicationLogs(@PathVariable Long id) {
        Application app = applicationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Application not found"));

        if (app.getTargetNode() == null) {
            return ResponseEntity.ok(Map.of("log", "No deployment has been triggered yet.", "status", "NONE"));
        }

        return deploymentLogRepository
                .findTopByTargetIpAndActionAndAppNameOrderByExecutedAtDesc(app.getTargetNode(), "DEPLOY_APP_FULL", app.getName())
                .map(log -> ResponseEntity.ok(Map.of(
                        "status", log.getStatus() != null ? log.getStatus() : "UNKNOWN",
                        "shortError", log.getShortError() != null ? log.getShortError() : "",
                        "log", log.getLogOutput() != null ? log.getLogOutput() : "No output captured.",
                        "executedAt", log.getExecutedAt() != null ? log.getExecutedAt().toString() : ""
                )))
                .orElse(ResponseEntity.ok(Map.of(
                        "log", "No deployment log found for this application.",
                        "status", "NONE"
                )));
    }

    /** Trigger a remote restart for a specific application. */
    @PostMapping("/{id}/restart")
    @RequiresPermission("APP_DEPLOYMENT_EDIT")
    public ResponseEntity<?> restartApplication(@PathVariable Long id) {
        Application app = applicationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Application not found"));

        // Transition to DEPLOYING status for visual feedback in UI
        app.setStatus("DEPLOYING");
        applicationRepository.save(app);

        // Trigger remote restart
        deploymentService.restartApplicationFull(id);

        return ResponseEntity.ok(Map.of("message", "Restart process started."));
    }

    /** Remove an application record from the database. */
    @DeleteMapping("/{id}")
    @RequiresPermission("APP_DEPLOYMENT_DELETE")
    public ResponseEntity<?> deleteApplication(@PathVariable Long id) {
        Application app = applicationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Application not found"));

        // Transition to DELETING status
        app.setStatus("DELETING");
        applicationRepository.save(app);

        // Trigger remote undeployment
        deploymentService.undeployApplicationFull(id);

        return ResponseEntity.ok(Map.of("message", "Undeployment started. Application will be removed shortly."));
    }

    /** Triggers a redeployment using previously saved credentials and parameters. */
    @PostMapping("/{id}/redeploy")
    @RequiresPermission("APP_DEPLOYMENT_CREATE")
    public ResponseEntity<?> redeployApplication(@PathVariable Long id, org.springframework.security.core.Authentication authentication) {
        Application app = applicationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Application not found"));

        Environment env = app.getEnvironment();
        
        // Convert saved entity back to a request DTO for the deployment service
        DeployRequestDTO request = new DeployRequestDTO();
        request.setId(app.getId());
        request.setName(app.getName());
        request.setEnvironmentId(env.getId());
        request.setType(app.getType());
        request.setAppLanguage(app.getAppLanguage());
        request.setRepoUrl(app.getRepoUrl());
        request.setTargetNode(app.getTargetNode());
        request.setBranch(app.getBranch());
        request.setPort(app.getPort());
        request.setSrcPath(app.getSrcPath());
        request.setContainerPort(app.getContainerPort());
        request.setGitToken(app.getGitToken());
        request.setEnvVars(parseEnvVars(app.getEnvVarsJson()));
        request.setAutoPromote(true);

        app.setStatus("DEPLOYING");
        app.setLastDeployedAt(LocalDateTime.now());
        applicationRepository.save(app);

        deploymentService.deployApplicationFull(env.getId(), request, app.getId(), null, authentication.getName());

        activityLogService.logActivity("Redeployment Started: " + app.getName(), "deployment", env.getName());
        return ResponseEntity.ok(Map.of("message", "Redeployment triggered successfully", "appId", app.getId()));
    }

    private Map<String, String> parseEnvVars(String json) {
        if (json == null || json.isEmpty()) return Map.of();
        try {
            return objectMapper.readValue(json, new com.fasterxml.jackson.core.type.TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }
    /** Transitions a Canary deployment to Stable. */
    @PostMapping("/{applicationId}/promote")
    @RequiresPermission("APP_DEPLOYMENT_EDIT")
    public ResponseEntity<?> promote(@PathVariable Long applicationId, @RequestParam Long environmentId, org.springframework.security.core.Authentication authentication) {
        deploymentService.promoteApplication(environmentId, applicationId, authentication.getName());
        activityLogService.logActivity("Canary Promoted: " + applicationId, "deployment", "Global");
        return ResponseEntity.ok(Map.of("message", "Application promotion triggered."));
    }

    @PostMapping("/check-running")
    @RequiresPermission("APP_DEPLOYMENT_WRITE")
    public ResponseEntity<Map<String, Object>> checkRunning(@RequestBody Map<String, String> request) {
        String targetIp = request.get("targetIp");
        String appName = request.get("appName");
        String port = request.get("port");

        if (targetIp == null || appName == null || port == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing parameters"));
        }

        boolean isRunning = deploymentService.isApplicationRunning(targetIp, appName, port);
        return ResponseEntity.ok(Map.of("isRunning", isRunning));
    }
}
