package com.monetique.eye.controller;

import com.monetique.eye.dto.ApplicationDTO;
import com.monetique.eye.dto.DeployRequestDTO;
import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.Environment;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.DeploymentLogRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.service.DeploymentService;
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

    @GetMapping
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
                .build()).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @PostMapping("/deploy")
    public ResponseEntity<?> deployApplication(@RequestBody DeployRequestDTO request) {
        Environment env = environmentRepository.findById(request.getEnvironmentId())
                .orElseThrow(() -> new RuntimeException("Environment not found"));

        Application app;
        if (request.getId() != null) {
            // Update existing app
            app = applicationRepository.findById(request.getId())
                .orElseThrow(() -> new RuntimeException("Application with ID " + request.getId() + " not found"));
            
            // Check if name is being changed and if new name conflicts
            if (!app.getName().equalsIgnoreCase(request.getName())) {
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
        
        // Persist SSH Credentials
        app.setSshUser(request.getSshUser());
        if (request.getSshPassword() != null && !request.getSshPassword().isEmpty()) {
            app.setSshPassword(request.getSshPassword());
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

        app.setStatus("DEPLOYING");
        app.setLastDeployedAt(LocalDateTime.now());

        applicationRepository.save(app);

        // Async deployment
        deploymentService.deployApplicationFull(env.getId(), request, app.getId());

        return ResponseEntity.ok(Map.of("message", "Deployment triggered successfully", "appId", app.getId()));
    }

    /** Poll live status of an application (for frontend polling while DEPLOYING). */
    @GetMapping("/{id}/status")
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
}
