package com.monetique.eye.service;

import com.monetique.eye.dto.StabilityResponse;
import com.monetique.eye.dto.TopologyData;
import com.monetique.eye.entity.Environment;
import com.monetique.eye.entity.LogAggregationWindow;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.repository.LogAggregationWindowRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

@Service
@RequiredArgsConstructor
@Slf4j
public class InfrastructureService {

    private final PrometheusClient prometheusClient;
    private final EnvironmentRepository environmentRepository;
    private final ApplicationRepository applicationRepository;
    private final LogAggregationWindowRepository aggregationRepository;

    // Cache last stability for trend calculation
    private final AtomicReference<Double> lastStabilityScore = new AtomicReference<>(99.6);

    public StabilityResponse getGlobalStats() {
        return getGlobalStability(); // Reusing the calculation but naming it properly for the stats card
    }

    public StabilityResponse getGlobalStability() {
        try {
            int totalEnvs = (int) environmentRepository.count();
            int activeNodes = prometheusClient.getTotalActiveNodes().intValue();

            // 1. Error Penalty (60% weight)
            double avgZScoreErrors = applicationRepository.findAll().stream()
                    .map(app -> aggregationRepository.findTop24ByApplicationOrderByWindowEndDesc(app))
                    .filter(list -> !list.isEmpty())
                    .mapToDouble(list -> {
                        LogAggregationWindow latest = list.get(0);
                        double mean = list.stream().mapToDouble(LogAggregationWindow::getErrorCount).average().orElse(0.0);
                        double variance = list.stream().mapToDouble(w -> Math.pow(w.getErrorCount() - mean, 2)).average().orElse(0.0);
                        double stdDev = Math.sqrt(variance);
                        return stdDev > 0 ? (latest.getErrorCount() - mean) / stdDev : 0.0;
                    })
                    .average()
                    .orElse(0.0);

            double errorPenalty = Math.max(0, avgZScoreErrors * 15);

            // 2. Resource Penalty (30% weight)
            Double avgCpu = prometheusClient.queryMetric("avg(1 - rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100");
            Double avgRam = prometheusClient.queryMetric("avg((1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100)");
            Double avgDisk = prometheusClient.queryMetric("avg(max(1 - (node_filesystem_avail_bytes{mountpoint=\"/\"} / node_filesystem_size_bytes{mountpoint=\"/\"})) by (instance) * 100)");

            double cpuOver = Math.max(0, (avgCpu != null ? avgCpu : 0.0) - 80);
            double ramOver = Math.max(0, (avgRam != null ? avgRam : 0.0) - 85);
            double diskOver = Math.max(0, (avgDisk != null ? avgDisk : 0.0) - 90);
            double resourcePenalty = (cpuOver + ramOver + diskOver) * 8;

            // 3. Drift Penalty (10% weight)
            double avgLogDrift = 0.0; 
            double driftPenalty = avgLogDrift * 10;

            double stability = 100 - (errorPenalty * 0.6 + resourcePenalty * 0.3 + driftPenalty * 0.1);
            stability = Math.max(0.0, Math.min(100.0, stability));

            double previous = lastStabilityScore.getAndSet(stability);
            double trend = stability - previous;

            return StabilityResponse.builder()
                    .avgStability(stability)
                    .trend(trend)
                    .totalEnvironments(totalEnvs)
                    .activeAgents(activeNodes)
                    .calculationTimestamp(LocalDateTime.now())
                    .build();

        } catch (Exception e) {
            log.error("Failed to calculate global stability: {}", e.getMessage(), e);
            return StabilityResponse.builder()
                    .avgStability(lastStabilityScore.get())
                    .trend(0.0)
                    .totalEnvironments(0)
                    .activeAgents(0)
                    .calculationTimestamp(LocalDateTime.now())
                    .build();
        }
    }

    public TopologyData getEnvironmentTopology(Long environmentId) {
        Environment env = environmentRepository.findById(environmentId)
                .orElseThrow(() -> new RuntimeException("Environment not found"));
        return getTopologyForEnvironment(env);
    }

    public TopologyData getAllEnvironmentsTopology() {
        log.info("Generating global topology for all environments");
        List<Environment> environments = environmentRepository.findAll();
        log.info("Found {} environments", environments.size());
        List<TopologyData.TopologyNode> allNodes = new ArrayList<>();
        List<TopologyData.TopologyEdge> allEdges = new ArrayList<>();

        for (Environment env : environments) {
            log.info("Processing topology for environment: {}", env.getName());
            TopologyData data = getTopologyForEnvironment(env);
            if (data.getNodes() != null) allNodes.addAll(data.getNodes());
            if (data.getEdges() != null) allEdges.addAll(data.getEdges());
        }

        return TopologyData.builder()
                .nodes(allNodes)
                .edges(allEdges)
                .build();
    }

    private TopologyData getTopologyForEnvironment(Environment env) {
        log.info("Starting topology fetch for environment: {}", env.getName());
        String label = env.getPrometheusLabel();
        log.info("Prometheus label: {}", label);
        List<TopologyData.TopologyNode> nodes = new ArrayList<>();
        List<TopologyData.TopologyEdge> edges = new ArrayList<>();

        // 1. Query only host-level instances (node-exporter) for this environment
        List<Map<String, Object>> instances = prometheusClient.queryList(String.format("up{environment=\"%s\", job=\"node-exporter\"}", label));
        
        // Group by IP to avoid duplicates (services like cadvisor, node-exporter on same host)
        java.util.Set<String> processedIps = new java.util.HashSet<>();
        int agentCount = 1;

        for (Map<String, Object> nodeMap : instances) {
            Map<String, String> metric = (Map<String, String>) nodeMap.get("metric");
            String instance = metric.get("instance"); // e.g. "192.168.126.131:9100"
            String ip = instance.split(":")[0];

            if (processedIps.contains(ip)) continue;
            processedIps.add(ip);

            // 2. Query Metrics for this specific host (using its main exporter port 9100)
            String nodeInstance = ip + ":9100";
            Double cpu = prometheusClient.getCpuUsageForInstance(nodeInstance);
            Double ram = prometheusClient.getMemoryUsagePercentForInstance(nodeInstance);

            if (cpu == 0.0 || ram == 0.0) {
                // Fallback to any instance on this IP if 9100 is not found or returns 0
                cpu = prometheusClient.queryMetric(String.format("avg(1 - rate(node_cpu_seconds_total{mode=\"idle\", instance=~\"%s.*\"}[5m])) * 100", ip));
                ram = prometheusClient.queryMetric(String.format("(1 - (node_memory_MemAvailable_bytes{instance=~\"%s.*\"} / node_memory_MemTotal_bytes{instance=~\"%s.*\"})) * 100", ip, ip));
            }

            // 3. Status logic
            String status = "HEALTHY";
            if (cpu > 90 || ram > 90) status = "CRITICAL";
            else if (cpu > 80 || ram > 85) status = "WARNING";

            String nodeLabel = metric.get("nodename");
            boolean isCentralNode = ip.equals(env.getCentralNodeIp()) || 
                                   ip.equalsIgnoreCase("node-exporter") || 
                                   ip.equalsIgnoreCase("localhost") ||
                                   ip.equalsIgnoreCase("backend") ||
                                   ip.equalsIgnoreCase("vmpipe");

            if (nodeLabel == null || nodeLabel.isEmpty()) {
                if (isCentralNode) {
                    nodeLabel = "vmpipe";
                } else {
                    nodeLabel = "node-" + (agentCount++);
                }
            }

            // If it's a known central node but the IP extracted was a service name, use the real IP
            String displayIp = isCentralNode ? env.getCentralNodeIp() : ip;

            nodes.add(TopologyData.TopologyNode.builder()
                    .id("node-" + env.getId() + "-" + (isCentralNode ? "central" : ip.replace(".", "-")))
                    .label(nodeLabel)
                    .ip(displayIp)
                    .type(isCentralNode ? "db-server" : "server")
                    .cpu(cpu.intValue())
                    .ram(ram.intValue())
                    .status(status)
                    .environmentId(env.getId())
                    .environmentName(env.getName())
                    .build());
        }

        // 4. Generate edges (connect agents to central node)
        String centralId = null;
        for (TopologyData.TopologyNode node : nodes) {
            if (node.getIp().equals(env.getCentralNodeIp())) {
                centralId = node.getId();
                break;
            }
        }

        if (centralId != null) {
            for (TopologyData.TopologyNode node : nodes) {
                if (!node.getId().equals(centralId)) {
                    edges.add(TopologyData.TopologyEdge.builder()
                            .source(node.getId())
                            .target(centralId)
                            .build());
                }
            }
        } else if (!nodes.isEmpty()) {
            // If no central node, connect sequentially just for visual links
            for (int i = 0; i < nodes.size() - 1; i++) {
                edges.add(TopologyData.TopologyEdge.builder()
                        .source(nodes.get(i).getId())
                        .target(nodes.get(i+1).getId())
                        .build());
            }
        }

        return TopologyData.builder()
                .nodes(nodes)
                .edges(edges)
                .build();
    }
}
