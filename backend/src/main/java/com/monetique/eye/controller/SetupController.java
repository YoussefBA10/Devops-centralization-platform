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
@RequestMapping("/api/v1/setup")
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
        String environmentName = request.getOrDefault("environmentName", "central-node");
        String sshUser = request.getOrDefault("sshUser", "root");
        String osFamily = request.getOrDefault("osFamily", "ubuntu");
        
        if (vmpipeIp == null || vmpipeIp.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "vmpipe IP is required"));
        }

        try {
            // 1. Trigger Data Initialization (creates env + backend/frontend apps)
            Environment env = dataInitializer.manualInitialize(environmentName, vmpipeIp, sshUser);
            
            // 2. Register and Provision the central node
            deploymentService.updateInventory(environmentName, vmpipeIp, sshUser);
            deploymentService.deployAgentAsync(env, vmpipeIp, sshUser, "auto-provisioned", osFamily);
            
            return ResponseEntity.ok(Map.of("message", "System initialized successfully. Provisioning central node."));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Initialization failed: " + e.getMessage()));
        }
    }

    @PostMapping("/sync-monitoring")
    public ResponseEntity<Map<String, String>> syncMonitoring() {
        deploymentService.syncMonitoring();
        return ResponseEntity.ok(Map.of("message", "Global monitoring synchronization triggered."));
    }
}
