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
import java.util.concurrent.CompletableFuture;
import com.monetique.eye.entity.DeploymentLog;
import com.monetique.eye.repository.DeploymentLogRepository;

@RestController
@RequestMapping("/api/environments")
public class EnvironmentController {

    private final EnvironmentRepository environmentRepository;
    private final DeploymentService deploymentService;
    private final SecurityService securityService;
    private final com.monetique.eye.service.PrometheusClient prometheusClient;
    private final DeploymentLogRepository deploymentLogRepository;

    public EnvironmentController(EnvironmentRepository environmentRepository, 
                                 DeploymentService deploymentService, 
                                 SecurityService securityService,
                                 com.monetique.eye.service.PrometheusClient prometheusClient,
                                 DeploymentLogRepository deploymentLogRepository) {
        this.environmentRepository = environmentRepository;
        this.deploymentService = deploymentService;
        this.securityService = securityService;
        this.prometheusClient = prometheusClient;
        this.deploymentLogRepository = deploymentLogRepository;
    }

    @GetMapping
    public List<Environment> getAll() {
        return environmentRepository.findAll();
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(Map.of(
            "totalEnvironments", environmentRepository.count(),
            "totalActiveNodes", prometheusClient.getTotalActiveNodes(),
            "avgStability", prometheusClient.getAvgStability()
        ));
    }

    @GetMapping("/{id}/resources")
    public ResponseEntity<Map<String, Object>> getResources(@PathVariable Long id) {
        Environment env = environmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Environment not found"));
        
        String label = env.getPrometheusLabel() != null ? env.getPrometheusLabel() : env.getName().toLowerCase();
        
        return ResponseEntity.ok(Map.of(
            "cpuUsage", prometheusClient.getCpuUsage(label),
            "ramUsagePercent", prometheusClient.getMemoryUsagePercent(label),
            "diskUsagePercent", prometheusClient.getDiskUsagePercent(label),
            "nodeCount", prometheusClient.getActiveNodeCount(label)
        ));
    }

    @GetMapping("/{id}/nodes")
    public ResponseEntity<List<Map<String, Object>>> getNodes(@PathVariable Long id) {
        Environment env = environmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Environment not found"));
        
        String label = env.getPrometheusLabel() != null ? env.getPrometheusLabel() : env.getName().toLowerCase();
        
        // Fetch specific node details using Prometheus
        List<Map<String, Object>> nodes = prometheusClient.queryList(
            String.format("up{job=\"node-exporter\", environment=\"%s\"}", label)
        );
        
        return ResponseEntity.ok(nodes);
    }

    @PostMapping("/{id}/deploy-agent")
    @PreAuthorize("hasRole('ADMIN') or @securityService.canAccessEnvironment(#id)")
    public ResponseEntity<Map<String, Object>> deployAgent(@PathVariable Long id, @RequestBody Map<String, String> request) {
        Environment env = environmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Environment not found"));
        
        String targetIp = request.get("targetIp");
        String sshUser = request.get("sshUser");
        String sshPassword = request.get("sshPassword");
        
        CompletableFuture<DeploymentLog> futureLog = deploymentService.deployAgentAsync(env, targetIp, sshUser, sshPassword);
        
        // Return immediately with a placeholder, or wait slightly. Here we just return async confirmation.
        return ResponseEntity.ok(Map.of(
            "message", "Agent deployment triggered for " + targetIp,
            "status", "IN_PROGRESS"
        ));
    }

    @GetMapping("/deployments/latest/{envId}/{targetIp}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> getLatestDeploymentStatus(@PathVariable Long envId, @PathVariable String targetIp) {
        // Find latest deployment log for this environment and IP. We will just use a generic call or search.
        // For simplicity, we'll assume the frontend can just fetch the latest deployment log or poll.
        var logOpt = deploymentLogRepository.findAll().stream()
                .filter(l -> l.getEnvironment().getId().equals(envId) && targetIp.equals(l.getTargetIp()))
                .reduce((first, second) -> second); // Get last
        
        if (logOpt.isPresent()) {
            return ResponseEntity.ok(Map.of("status", logOpt.get().getStatus()));
        }
        return ResponseEntity.notFound().build();
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
