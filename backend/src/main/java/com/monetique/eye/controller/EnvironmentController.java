package com.monetique.eye.controller;

import com.monetique.eye.entity.Environment;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.service.DeploymentService;
import com.monetique.eye.service.SecurityService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/environments")
public class EnvironmentController {

    private final EnvironmentRepository environmentRepository;
    private final DeploymentService deploymentService;
    private final SecurityService securityService;

    public EnvironmentController(EnvironmentRepository environmentRepository, 
                                 DeploymentService deploymentService, 
                                 SecurityService securityService) {
        this.environmentRepository = environmentRepository;
        this.deploymentService = deploymentService;
        this.securityService = securityService;
    }

    @GetMapping
    public List<Environment> getAll() {
        // In a real app, filter by user access via securityService
        return environmentRepository.findAll();
    }

    @PostMapping("/{id}/deploy-agent")
    @PreAuthorize("hasRole('ADMIN') or @securityService.canAccessEnvironment(#id)")
    public ResponseEntity<Map<String, String>> deployAgent(@PathVariable Long id, @RequestBody Map<String, String> request) {
        Environment env = environmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Environment not found"));
        
        String targetIp = request.get("targetIp");
        deploymentService.deployAgent(env, targetIp);
        
        return ResponseEntity.ok(Map.of("message", "Agent deployment triggered for " + targetIp));
    }

    @PostMapping("/{id}/deploy-application")
    @PreAuthorize("hasRole('ADMIN') or @securityService.canAccessEnvironment(#id)")
    public ResponseEntity<Map<String, String>> deployApplication(@PathVariable Long id, @RequestBody Map<String, String> request) {
        Environment env = environmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Environment not found"));
        
        String targetIp = request.get("targetIp");
        String sshUser = request.getOrDefault("sshUser", "root");
        String appName = request.get("appName");
        
        deploymentService.deployApplication(env, targetIp, sshUser, appName);
        
        return ResponseEntity.ok(Map.of("message", "Application deployment triggered for " + appName + " at " + targetIp));
    }
    
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Environment create(@RequestBody Environment environment) {
        return environmentRepository.save(environment);
    }
}
