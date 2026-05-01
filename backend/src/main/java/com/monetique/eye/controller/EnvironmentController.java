package com.monetique.eye.controller;

import com.monetique.eye.entity.Environment;
import com.monetique.eye.entity.EnvironmentAccess;
import com.monetique.eye.entity.User;
import com.monetique.eye.entity.enums.Role;
import com.monetique.eye.repository.EnvironmentAccessRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.service.DeploymentService;
import com.monetique.eye.service.SecurityService;
import com.monetique.eye.security.RequiresPermission;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
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
    private final EnvironmentAccessRepository environmentAccessRepository;
    private final com.monetique.eye.repository.ClusterRepository clusterRepository;

    private final com.monetique.eye.service.ActivityLogService activityLogService;

    public EnvironmentController(EnvironmentRepository environmentRepository,
            DeploymentService deploymentService,
            SecurityService securityService,
            com.monetique.eye.service.PrometheusClient prometheusClient,
            DeploymentLogRepository deploymentLogRepository,
            com.monetique.eye.repository.UserRepository userRepository,
            com.monetique.eye.repository.ManagedNodeRepository managedNodeRepository,
            EnvironmentAccessRepository environmentAccessRepository,
            com.monetique.eye.repository.ClusterRepository clusterRepository,
            com.monetique.eye.service.ActivityLogService activityLogService) {
        this.environmentRepository = environmentRepository;
        this.deploymentService = deploymentService;
        this.securityService = securityService;
        this.prometheusClient = prometheusClient;
        this.deploymentLogRepository = deploymentLogRepository;
        this.userRepository = userRepository;
        this.managedNodeRepository = managedNodeRepository;
        this.environmentAccessRepository = environmentAccessRepository;
        this.clusterRepository = clusterRepository;
        this.activityLogService = activityLogService;
    }

    private String getLabelValue(String label) {
        if (label == null || label.isEmpty()) {
            return label;
        }
        if (label.contains("=")) {
            return label.substring(label.indexOf('=') + 1);
        }
        return label;
    }

    @GetMapping
    @RequiresPermission("ENV_DEPLOYMENT_VIEW")
    public List<Environment> getAll(@RequestParam(required = false) Long clusterId) {
        User user = securityService.getCurrentUser();
        List<Environment> all;
        
        if (user.getRole() == Role.ADMIN) {
            all = environmentRepository.findAll();
        } else {
            List<String> allowedIds = environmentAccessRepository.findByUserId(user.getUsername()).stream()
                    .map(EnvironmentAccess::getEnvironmentId)
                    .collect(Collectors.toList());
            
            all = environmentRepository.findAll().stream()
                    .filter(env -> allowedIds.contains(env.getId().toString()))
                    .collect(Collectors.toList());
        }

        if (clusterId != null) {
            return all.stream()
                    .filter(env -> env.getCluster() != null && env.getCluster().getId().equals(clusterId))
                    .collect(Collectors.toList());
        }
        
        return all;
    }

    @GetMapping("/stats")
    @RequiresPermission("ENV_DEPLOYMENT_VIEW")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(Map.of(
                "totalEnvironments", environmentRepository.count(),
                "totalActiveNodes", prometheusClient.getTotalActiveNodes(),
                "avgStability", prometheusClient.getAvgStability()));
    }

    @GetMapping("/{id}/resources")
    @RequiresPermission("ENV_DEPLOYMENT_VIEW")
    public ResponseEntity<Map<String, Object>> getResources(@PathVariable Long id) {
        Environment env = environmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Environment not found"));

        String label = getLabelValue(env.getPrometheusLabel());
        long totalNodes = managedNodeRepository.countByEnvironment(env);
        
        return ResponseEntity.ok(Map.of(
                "cpuUsage", prometheusClient.getCpuUsage(label),
                "ramUsagePercent", prometheusClient.getMemoryUsagePercent(label),
                "diskUsagePercent", prometheusClient.getDiskUsagePercent(label),
                "nodeCount", prometheusClient.getActiveNodeCount(label),
                "totalNodes", totalNodes));
    }

    @GetMapping("/{id}/nodes")
    @RequiresPermission("ENV_DEPLOYMENT_VIEW")
    public ResponseEntity<List<Map<String, Object>>> getNodes(@PathVariable Long id) {
        Environment env = environmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Environment not found"));

        String label = getLabelValue(env.getPrometheusLabel());
        if (label == null || label.isBlank()) {
            label = env.getSafeName();
        }
        
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

            // Only collapse into "central-node" if it's an internal service name or the central node IP
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
                    if ("1.0".equals(value) || "1".equals(value)) {
                        s.put("status", "Online");
                    }
                    break;
                }
            }
            if (!exists) {
                services.add(new HashMap<>(
                        Map.of("name", job, "status", "1.0".equals(value) || "1".equals(value) ? "Online" : "Offline", "type", "AGENT")));
            }

            if ("node-exporter".equals(job) && ("1.0".equals(value) || "1".equals(value))) {
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

    @PostMapping
    @RequiresPermission("ENV_DEPLOYMENT_CREATE")
    public Environment create(@RequestBody Map<String, Object> payload) {
        Environment env = Environment.builder()
                .name((String) payload.get("name"))
                .description((String) payload.get("description"))
                .prometheusLabel((String) payload.get("prometheusLabel"))
                .centralNodeIp((String) payload.get("centralNodeIp"))
                .build();
        
        if (payload.get("clusterId") != null) {
            clusterRepository.findById(Long.valueOf(payload.get("clusterId").toString()))
                    .ifPresent(env::setCluster);
        }

        Environment saved = environmentRepository.save(env);
        activityLogService.logActivity("Environment Created: " + env.getName(), "environment", env.getName());
        
        // Auto-assign the creator to the new environment
        User currentUser = securityService.getCurrentUser();
        if (currentUser != null && currentUser.getRole() != Role.ADMIN) {
            EnvironmentAccess access = EnvironmentAccess.builder()
                    .userId(currentUser.getUsername())
                    .environmentId(saved.getId().toString())
                    .build();
            environmentAccessRepository.save(access);
        }
        
        return saved;
    }

    @PutMapping("/{id}")
    @RequiresPermission("ENV_DEPLOYMENT_EDIT")
    public Environment update(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        Environment existing = environmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Environment not found"));
        
        // Update only metadata fields
        existing.setName((String) payload.get("name"));
        existing.setDescription((String) payload.get("description"));
        existing.setPrometheusLabel((String) payload.get("prometheusLabel"));
        existing.setCentralNodeIp((String) payload.get("centralNodeIp"));
        
        if (payload.containsKey("clusterId")) {
            if (payload.get("clusterId") != null) {
                clusterRepository.findById(Long.valueOf(payload.get("clusterId").toString()))
                        .ifPresent(existing::setCluster);
            } else {
                existing.setCluster(null);
            }
        }
        
        Environment saved = environmentRepository.save(existing);
        activityLogService.logActivity("Environment Updated: " + saved.getName(), "environment", saved.getName());
        return saved;
    }

    @DeleteMapping("/{id}")
    @RequiresPermission("ENV_DEPLOYMENT_DELETE")
    public void delete(@PathVariable Long id) {
        environmentRepository.findById(id).ifPresent(env -> {
            activityLogService.logActivity("Environment Deletion Started: " + env.getName(), "environment", env.getName());
            
            // 1. Undeploy all nodes associated with this environment
            java.util.List<com.monetique.eye.entity.ManagedNode> nodes = managedNodeRepository.findByEnvironment(env);
            for (com.monetique.eye.entity.ManagedNode node : nodes) {
                deploymentService.undeployAgentAsync(env, node.getIp(), node.getSshUser(), node.getSshPassword());
            }

            // 2. Clean up inventory group
            deploymentService.removeEnvironmentFromInventory(env.getName());
            
            // 3. Delete the environment record (and related records via cascade)
            environmentRepository.deleteById(id);
        });
    }

    @PostMapping("/{id}/deploy-agent")
    @RequiresPermission("ENV_DEPLOYMENT_CREATE")
    public ResponseEntity<Map<String, Object>> deployAgent(@PathVariable Long id,
            @RequestBody Map<String, String> request) {
        Environment env = environmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Environment not found"));

        String targetIp = request.get("targetIp");
        String sshUser = request.get("sshUser");
        String sshPassword = request.get("sshPassword");
        String osFamily = request.getOrDefault("osFamily", "ubuntu");

        if (targetIp == null || sshUser == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "targetIp and sshUser are required"));
        }

        // Task 1: Check if node already exists
        if (managedNodeRepository.findByEnvironmentAndIp(env, targetIp).isPresent()) {
            return ResponseEntity.status(400).body(Map.of(
                "message", "Node with IP " + targetIp + " is already registered in environment '" + env.getName() + "'.",
                "status", "ERROR"
            ));
        }

        CompletableFuture<DeploymentLog> futureLog = deploymentService.deployAgentAsync(env, targetIp, sshUser,
                sshPassword, osFamily);

        activityLogService.logActivity("Node Deployment Started: " + targetIp, "infrastructure", env.getName());
        return ResponseEntity.ok(Map.of(
                "message", "Agent deployment triggered for " + targetIp,
                "status", "IN_PROGRESS"));
    }

    @DeleteMapping("/{id}/nodes/{ip}")
    @RequiresPermission("ENV_DEPLOYMENT_DELETE")
    public ResponseEntity<Map<String, Object>> undeployAgent(
            @PathVariable Long id,
            @PathVariable String ip) {
        Environment env = environmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Environment not found"));

        // Fetch credentials from ManagedNode
        Optional<com.monetique.eye.entity.ManagedNode> nodeOpt = managedNodeRepository.findByEnvironmentAndIp(env, ip);
        
        if (nodeOpt.isPresent()) {
            com.monetique.eye.entity.ManagedNode node = nodeOpt.get();
            deploymentService.undeployAgentAsync(env, ip, node.getSshUser(), node.getSshPassword());
        } else {
            // If credentials are missing, we can still attempt to clean up Prometheus and Inventory records
            deploymentService.undeployAgentAsync(env, ip, null, null);
        }

        activityLogService.logActivity("Node Undeployment Started: " + ip, "infrastructure", env.getName());
        return ResponseEntity.ok(Map.of(
                "message", "Agent undeployment triggered for " + ip,
                "status", "IN_PROGRESS"));
    }

    @GetMapping("/deployments/status")
    @RequiresPermission("ENV_DEPLOYMENT_VIEW")
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

    @GetMapping("/{id}/deploy-logs")
    @RequiresPermission("ENV_DEPLOYMENT_VIEW")
    public ResponseEntity<?> getDeployLogs(@PathVariable Long id, @RequestParam String nodeIp) {
        return deploymentLogRepository.findTopByTargetIpAndActionOrderByExecutedAtDesc(nodeIp, "DEPLOY_NODE")
                .map(log -> ResponseEntity.ok(Map.of(
                        "status", log.getStatus(),
                        "log", log.getLogOutput(),
                        "executedAt", log.getExecutedAt().toString()
                )))
                .orElse(ResponseEntity.ok(Map.of("log", "No logs found for this node.", "status", "NONE")));
    }
}
