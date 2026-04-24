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
    private final com.monetique.eye.repository.UserRepository userRepository;
    private final com.monetique.eye.repository.ManagedNodeRepository managedNodeRepository;

    private final com.monetique.eye.service.ActivityLogService activityLogService;

    public EnvironmentController(EnvironmentRepository environmentRepository,
            DeploymentService deploymentService,
            SecurityService securityService,
            com.monetique.eye.service.PrometheusClient prometheusClient,
            DeploymentLogRepository deploymentLogRepository,
            com.monetique.eye.repository.UserRepository userRepository,
            com.monetique.eye.repository.ManagedNodeRepository managedNodeRepository,
            com.monetique.eye.service.ActivityLogService activityLogService) {
        this.environmentRepository = environmentRepository;
        this.deploymentService = deploymentService;
        this.securityService = securityService;
        this.prometheusClient = prometheusClient;
        this.deploymentLogRepository = deploymentLogRepository;
        this.userRepository = userRepository;
        this.managedNodeRepository = managedNodeRepository;
        this.activityLogService = activityLogService;
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
                "avgStability", prometheusClient.getAvgStability()));
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
                "nodeCount", prometheusClient.getActiveNodeCount(label)));
    }

    @GetMapping("/{id}/nodes")
    public ResponseEntity<List<Map<String, Object>>> getNodes(@PathVariable Long id) {
        Environment env = environmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Environment not found"));

        String label = resolvePrometheusLabel(env);
        List<Map<String, Object>> resultNodes = new ArrayList<>();

        // 1. Fetch Agents (node-exporter, cadvisor, filebeat)
        List<Map<String, Object>> agentMetrics = prometheusClient.queryList(
                String.format("up{job=~\"node-exporter|cadvisor|filebeat\", environment=\"%s\"}", label));

        // 2. Fetch Containers
        List<Map<String, Object>> containerMetrics = prometheusClient.queryList(
                String.format("time() - container_last_seen{environment=\"%s\", name!=\"\"} < 60", label));

        // Map to group by Host/Instance
        Map<String, Map<String, Object>> nodeMap = new HashMap<>();

        // Process Agents to identify Nodes
        for (Map<String, Object> metricData : agentMetrics) {
            Map<String, String> metric = (Map<String, String>) metricData.get("metric");
            String instance = metric.get("instance");
            String job = metric.get("job");
            String value = metricData.get("value").toString();

            // Extract IP/Hostname from instance (remove port)
            String rawIp = instance != null ? instance.split(":")[0] : "unknown";
            String nodeKey = rawIp;
            String nodeDisplayName = "node-" + rawIp.replaceAll(".*\\.", ""); // e.g., node-131

            // Only collapse into "central-node" if it's an internal service name or the central
            // node IP
            if ("central-node".equals(label) && ("node-exporter".equals(rawIp) ||
                    "cadvisor".equals(rawIp) ||
                    "filebeat".equals(rawIp) ||
                    "localhost".equals(rawIp) ||
                    rawIp.equals(env.getCentralNodeIp()))) {
                nodeKey = "central-node";
                rawIp = env.getCentralNodeIp() != null ? env.getCentralNodeIp() : "127.0.0.1";
                nodeDisplayName = "central-node";
            }

            nodeMap.putIfAbsent(nodeKey, new HashMap<>(Map.of(
                    "nodeName", nodeDisplayName,
                    "ip", rawIp,
                    "status", "Offline",
                    "services", new ArrayList<Map<String, String>>())));

            Map<String, Object> nodeInfo = nodeMap.get(nodeKey);
            List<Map<String, String>> services = (List<Map<String, String>>) nodeInfo.get("services");
            boolean exists = false;
            for (Map<String, String> s : services) {
                if (s.get("name").equals(job) && "AGENT".equals(s.get("type"))) {
                    exists = true;
                    // Always prefer "Online" over "Offline" if multiple metrics exist
                    if ("1".equals(value)) {
                        s.put("status", "Online");
                    }
                    break;
                }
            }
            if (!exists) {
                services.add(new HashMap<>(
                        Map.of("name", job, "status", "1".equals(value) ? "Online" : "Offline", "type", "AGENT")));
            }

            if ("node-exporter".equals(job) && "1".equals(value)) {
                nodeInfo.put("status", "Online");
            }
        }

        // Process Containers
        for (Map<String, Object> metricData : containerMetrics) {
            Map<String, String> metric = (Map<String, String>) metricData.get("metric");
            String name = metric.get("name");
            String instance = metric.get("instance");

            if (name == null || name.trim().isEmpty())
                continue;

            String rawIp = instance != null ? instance.split(":")[0] : "unknown";
            String nodeKey = rawIp;
            String nodeDisplayName = "node-" + rawIp.replaceAll(".*\\.", "");

            if ("central-node".equals(label) && ("cadvisor".equals(rawIp) ||
                    "localhost".equals(rawIp) ||
                    rawIp.equals(env.getCentralNodeIp()))) {
                nodeKey = "central-node";
                rawIp = env.getCentralNodeIp() != null ? env.getCentralNodeIp() : "127.0.0.1";
                nodeDisplayName = "central-node";
            }

            nodeMap.putIfAbsent(nodeKey, new HashMap<>(Map.of(
                    "nodeName", nodeDisplayName,
                    "ip", rawIp,
                    "status", "Online",
                    "services", new ArrayList<Map<String, String>>())));

            List<Map<String, String>> services = (List<Map<String, String>>) nodeMap.get(nodeKey).get("services");

            // Deduplicate containers against both agents and other containers
            boolean exists = false;
            for (Map<String, String> s : services) {
                if (s.get("name").equals(name)) {
                    exists = true;
                    s.put("status", "Online"); // Ensure it's marked online if it was offline as an agent
                    break;
                }
            }
            if (!exists) {
                services.add(new HashMap<>(Map.of("name", name, "status", "Online", "type", "CONTAINER")));
            }
        }

        return ResponseEntity.ok(new ArrayList<>(nodeMap.values()));
    }

    @PostMapping("/{id}/deploy-agent")
    @PreAuthorize("hasRole('ADMIN') or @securityService.canAccessEnvironment(#id)")
    public ResponseEntity<Map<String, Object>> deployAgent(@PathVariable Long id,
            @RequestBody Map<String, String> request) {
        Environment env = environmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Environment not found"));

        String targetIp = request.get("targetIp");
        String sshUser = request.get("sshUser");
        String sshPassword = request.get("sshPassword");
        String osFamily = request.getOrDefault("osFamily", "ubuntu");

        // Task 1: Check if node already exists
        if (managedNodeRepository.findByEnvironmentAndIp(env, targetIp).isPresent()) {
            return ResponseEntity.status(400).body(Map.of(
                "message", "Node with IP " + targetIp + " is already registered in environment '" + env.getName() + "'.",
                "status", "ERROR"
            ));
        }

        CompletableFuture<DeploymentLog> futureLog = deploymentService.deployAgentAsync(env, targetIp, sshUser,
                sshPassword, osFamily);

        // Return immediately with a placeholder, or wait slightly. Here we just return
        // async confirmation.
        activityLogService.logActivity("Node Deployment Started: " + targetIp, "infrastructure", env.getName());
        return ResponseEntity.ok(Map.of(
                "message", "Agent deployment triggered for " + targetIp,
                "status", "IN_PROGRESS"));
    }

    @DeleteMapping("/{id}/nodes/{ip}")
    @PreAuthorize("hasRole('ADMIN') or @securityService.canAccessEnvironment(#id)")
    public ResponseEntity<Map<String, Object>> undeployAgent(
            @PathVariable Long id,
            @PathVariable String ip) {
        Environment env = environmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Environment not found"));

        // Fetch credentials from ManagedNode
        com.monetique.eye.entity.ManagedNode node = managedNodeRepository.findByEnvironmentAndIp(env, ip)
                .orElseThrow(() -> new RuntimeException("Node credentials not found for IP: " + ip));

        deploymentService.undeployAgentAsync(env, ip, node.getSshUser(), node.getSshPassword());

        activityLogService.logActivity("Node Undeployment Started: " + ip, "infrastructure", env.getName());
        return ResponseEntity.ok(Map.of(
                "message", "Agent undeployment triggered for " + ip,
                "status", "IN_PROGRESS"));
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
                    "log", log.getLogOutput() != null ? log.getLogOutput() : ""));
        }

        return ResponseEntity.ok(Map.of("status", "NOT_FOUND"));
    }

    @PostMapping("/{id}/deploy-application")
    @PreAuthorize("hasRole('ADMIN') or @securityService.canAccessEnvironment(#id)")
    public ResponseEntity<Map<String, String>> deployApplication(@PathVariable Long id,
            @RequestBody Map<String, String> request) {
        Environment env = environmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Environment not found"));

        String targetIp = request.get("targetIp");
        String sshUser = request.getOrDefault("sshUser", "root");
        String appName = request.get("appName");

        deploymentService.deployApplication(env, targetIp, sshUser, appName);

        return ResponseEntity
                .ok(Map.of("message", "Application deployment triggered for " + appName + " at " + targetIp));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Environment create(@RequestBody Environment environment) {
        if (environmentRepository.findByName(environment.getName()).isPresent()) {
            throw new RuntimeException("Environment with name '" + environment.getName() + "' already exists");
        }
        Environment env = environmentRepository.save(environment);
        activityLogService.logActivity("Environment Created: " + env.getName(), "system", env.getName());
        // Initialize inventory group for this environment
        deploymentService.updateInventory(env.getName(), null, null);
        return env;
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or @securityService.canAccessEnvironment(#id)")
    public ResponseEntity<Environment> update(@PathVariable Long id, @RequestBody Environment details) {
        Environment env = environmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Environment not found"));

        env.setName(details.getName());
        env.setDescription(details.getDescription());
        env.setPrometheusLabel(details.getPrometheusLabel());

        Environment saved = environmentRepository.save(env);
        activityLogService.logActivity("Environment Updated: " + saved.getName(), "system", saved.getName());
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<Map<String, String>> delete(@PathVariable Long id) {
        Environment env = environmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Environment not found"));

        // 1. Manually clean up User associations (Join Table)
        env.getUsers().forEach(user -> {
            user.getEnvironments().remove(env);
            userRepository.save(user);
        });

        // 2. Remove from Ansible inventory
        deploymentService.removeEnvironmentFromInventory(env.getName());

        // 3. Delete environment (Cascades will handle applications, logs, and tickets)
        environmentRepository.delete(env);
        activityLogService.logActivity("Environment Deleted: " + env.getName(), "system", "Global");
        
        return ResponseEntity.ok(Map.of("message", "Environment deleted successfully"));
    }
}
