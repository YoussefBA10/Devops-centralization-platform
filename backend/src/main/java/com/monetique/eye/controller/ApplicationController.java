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
                .build()).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @PostMapping("/deploy")
    public ResponseEntity<?> deployApplication(@RequestBody DeployRequestDTO request) {
        Environment env = environmentRepository.findById(request.getEnvironmentId())
                .orElseThrow(() -> new RuntimeException("Environment not found"));

        Application app = applicationRepository.findAll().stream()
                .filter(a -> a.getName().equalsIgnoreCase(request.getName())
                        && a.getEnvironment().getId().equals(request.getEnvironmentId()))
                .findFirst()
                .orElse(Application.builder()
                        .name(request.getName())
                        .environment(env)
                        .serviceNameKeyword(request.getName().toLowerCase())
                        .build());

        app.setType(request.getType());
        app.setAppLanguage(request.getAppLanguage());
        app.setRepoUrl(request.getRepoUrl());
        app.setTargetNode(request.getTargetNode());
        app.setBranch(request.getBranch());
        app.setPort(request.getPort());
        app.setSrcPath(request.getSrcPath());
        app.setStatus("DEPLOYING");
        app.setLastDeployedAt(LocalDateTime.now());

        applicationRepository.save(app);

        // Async deployment
        deploymentService.deployApplicationFull(env, request, app);

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
                .findTopByTargetIpAndActionOrderByExecutedAtDesc(app.getTargetNode(), "DEPLOY_APP_FULL")
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

    /** Remove an application record from the database. */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteApplication(@PathVariable Long id) {
        applicationRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Application removed."));
    }
}
