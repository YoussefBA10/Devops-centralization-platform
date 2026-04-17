package com.monetique.eye.controller;

import com.monetique.eye.dto.ApplicationDTO;
import com.monetique.eye.dto.DeployRequestDTO;
import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.Environment;
import com.monetique.eye.repository.ApplicationRepository;
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
                .build()).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @PostMapping("/deploy")
    public ResponseEntity<?> deployApplication(@RequestBody DeployRequestDTO request) {
        Environment env = environmentRepository.findById(request.getEnvironmentId())
                .orElseThrow(() -> new RuntimeException("Environment not found"));

        Application app = applicationRepository.findAll().stream()
                .filter(a -> a.getName().equalsIgnoreCase(request.getName()) && a.getEnvironment().getId().equals(request.getEnvironmentId()))
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
        app.setStatus("DEPLOYING");
        app.setLastDeployedAt(LocalDateTime.now());
        
        applicationRepository.save(app);

        // Async deployment
        deploymentService.deployApplicationFull(env, request, app);

        return ResponseEntity.ok(Map.of("message", "Deployment triggered successfuly", "appId", app.getId()));
    }
}
