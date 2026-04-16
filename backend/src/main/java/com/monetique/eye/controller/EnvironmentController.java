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
import java.util.ArrayList;
import java.util.HashMap;
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

    private String resolvePrometheusLabel(Environment env) {
        String label = env.getPrometheusLabel();
        if (label == null || label.isBlank()) {
            return env.getName().toLowerCase().replaceAll("\\s+", "-");
        }
        if (label.contains("=")) {
            return label.substring(label.indexOf('=') + 1);
        }
        return label;
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
        
        String label = resolvePrometheusLabel(env);
        
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

        String label = resolvePrometheusLabel(env);

        // 1. Fetch Agents (node-exporter, cadvisor, filebeat)
        List<Map<String, Object>> agentMetrics = prometheusClient.queryList(
                String.format("up{environment=\"%s\"}", label));

        // 2. Fetch Containers (only for nodes that already exist)
        List<Map<String, Object>> containerMetrics = prometheusClient.queryList(
                String.format("time() - container_last_seen{environment=\"%s\", name!=\"\"} < 60", label));

        // Map to group by node label
        Map<String, Map<String, Object>> nodeMap = new HashMap<>();

        // Process Agents to identify Nodes
        for (Map<String, Object> metricData : agentMetrics) {
            Map<String, String> metric = (Map<String, String>) metricData.get("metric");
            String job = metric.get("job");
            String value = metricData.get("value").toString();
            String instance = metric.get("instance");
            
            // Use the 'node' label for grouping; fall back to instance IP
            String nodeKey = metric.get("node");
            if (nodeKey == null || nodeKey.isEmpty()) {
                nodeKey = instance != null ? instance.split(":")[0] : "unknown";
            }

            // Extract IP from instance
            String ip = instance != null ? instance.split(":")[0] : "N/A";
            // For central node internal services, use the central node IP
            if (env.getCentralNodeIp() != null && (
                ip.equals("node-exporter") || ip.equals("cadvisor") || 
                ip.equals("filebeat") || ip.equals("localhost"))) {
                ip = env.getCentralNodeIp();
            }

            if (!nodeMap.containsKey(nodeKey)) {
                Map<String, Object> nodeInfo = new HashMap<>();
                nodeInfo.put("nodeName", nodeKey);
                nodeInfo.put("ip", ip);
                nodeInfo.put("status", "Offline");
                nodeInfo.put("services", new ArrayList<Map<String, String>>());
                nodeMap.put(nodeKey, nodeInfo);
            }

            Map<String, Object> nodeInfo = nodeMap.get(nodeKey);
            List<Map<String, String>> services = (List<Map<String, String>>) nodeInfo.get("services");
            
            // Deduplicate: don't add if same job already exists
            boolean exists = services.stream().anyMatch(s -> s.get("name").equals(job));
            if (!exists) {
                services.add(Map.of("name", job, "status", "1".equals(value) ? "Online" : "Offline", "type", "AGENT"));
            }
            if ("node-exporter".equals(job) && "1".equals(value)) {
                nodeInfo.put("status", "Online");
            }
        }

        // Process Containers — only add to existing nodes, not as new top-level nodes
        for (Map<String, Object> metricData : containerMetrics) {
            Map<String, String> metric = (Map<String, String>) metricData.get("metric");
            String name = metric.get("name");
            
            // Use the 'node' label for grouping; fall back to instance IP
            String nodeKey = metric.get("node");
            if (nodeKey == null || nodeKey.isEmpty()) {
                String instance = metric.get("instance");
                nodeKey = instance != null ? instance.split(":")[0] : "unknown";
            }

            // Only add containers to nodes that were already discovered via agents
            if (!nodeMap.containsKey(nodeKey)) continue;

            List<Map<String, String>> services = (List<Map<String, String>>) nodeMap.get(nodeKey).get("services");
            // Deduplicate: don't add if same container name already exists
            boolean exists = services.stream().anyMatch(s -> s.get("name").equals(name));
            if (!exists) {
                services.add(Map.of("name", name, "status", "Online", "type", "CONTAINER"));
            }
        }

        return ResponseEntity.ok(new ArrayList<>(nodeMap.values()));
    }

    @PostMapping("/{id}/deploy-agent")
    @PreAuthorize("hasRole('ADMIN') or @securityService.canAccessEnvironment(#id)")
    public ResponseEntity<Map<String, Object>> deployAgent(@PathVariable Long id, @RequestBody Map<String, String> request) {
        Environment env = environmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Environment not found"));
        
        String targetIp = request.get("targetIp");
        String sshUser = request.get("sshUser");
        String sshPassword = request.get("sshPassword");
        String nodeName = request.get("nodeName");
        
        CompletableFuture<DeploymentLog> futureLog = deploymentService.deployAgentAsync(env, targetIp, sshUser, sshPassword, nodeName);
        
        // Return immediately with a placeholder, or wait slightly. Here we just return async confirmation.
        return ResponseEntity.ok(Map.of(
            "message", "Agent deployment triggered for " + targetIp,
            "status", "IN_PROGRESS"
        ));
    }

    @GetMapping("/deployments/status")
    @PreAuthorize("hasRole('ADMIN') or @securityService.canAccessEnvironment(#environmentId)")
    public ResponseEntity<Map<String, Object>> getDeploymentStatus(
            @RequestParam Long environmentId, 
            @RequestParam String targetIp) {
            
        // Find latest deployment log for this environment and IP
        var logOpt = deploymentLogRepository.findAll().stream()
                .filter(l -> l.getEnvironment().getId().equals(environmentId) && targetIp.equals(l.getTargetIp()))
                .reduce((first, second) -> second);
        
        if (logOpt.isPresent()) {
            DeploymentLog log = logOpt.get();
            return ResponseEntity.ok(Map.of(
                "status", log.getStatus(),
                "action", log.getAction(),
                "timestamp", log.getExecutedAt(),
                "log", log.getLogOutput() != null ? log.getLogOutput() : ""
            ));
        }
        
        return ResponseEntity.ok(Map.of("status", "NOT_FOUND"));
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
