package com.monetique.eye.controller;

import com.monetique.eye.config.DataInitializer;
import com.monetique.eye.entity.Environment;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.service.DeploymentService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/setup")
public class SetupController {

    private final EnvironmentRepository environmentRepository;
    private final DataInitializer dataInitializer;
    private final DeploymentService deploymentService;

    public SetupController(EnvironmentRepository environmentRepository, 
                           DataInitializer dataInitializer,
                           DeploymentService deploymentService) {
        this.environmentRepository = environmentRepository;
        this.dataInitializer = dataInitializer;
        this.deploymentService = deploymentService;
    }

    @PostMapping("/initialize")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> initialize(@RequestBody Map<String, String> request) {
        if (environmentRepository.count() > 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "Platform is already initialized"));
        }

        String vmpipeIp = request.get("vmpipeIp");
        String environmentName = request.getOrDefault("environmentName", "vmpipe");
        
        if (vmpipeIp == null || vmpipeIp.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "vmpipe IP is required"));
        }

        try {
            // 1. Trigger Data Initialization
            Environment env = dataInitializer.manualInitialize(environmentName, vmpipeIp);
            
            // 2. Register the central node itself in Prometheus
            deploymentService.registerNodeInPrometheus(env, vmpipeIp);
            
            return ResponseEntity.ok(Map.of("message", "System initialized successfully"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Initialization failed: " + e.getMessage()));
        }
    }
}
