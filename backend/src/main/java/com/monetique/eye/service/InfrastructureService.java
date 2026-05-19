package com.monetique.eye.service;

import com.monetique.eye.dto.ServiceResourceDTO;
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

import com.monetique.eye.dto.IncidentDTO;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class InfrastructureService {

    private final PrometheusClient prometheusClient;
    private final EnvironmentRepository environmentRepository;
    private final ApplicationRepository applicationRepository;
    private final LogAggregationWindowRepository aggregationRepository;
    private final com.monetique.eye.repository.ClusterRepository clusterRepository;
    private final com.monetique.eye.repository.ManagedNodeRepository managedNodeRepository;

    private final AtomicReference<Double> lastStabilityScore = new AtomicReference<>(99.6);

    public StabilityResponse getGlobalStats() {
        return getGlobalStability();
    }

    public StabilityResponse getGlobalStability() {
        try {
            int totalEnvs = (int) environmentRepository.count();
            int activeNodes = prometheusClient.getTotalActiveNodes().intValue();

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

            Double avgCpu = prometheusClient.queryMetric("avg(1 - rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100");
            Double avgRam = prometheusClient.queryMetric("avg((1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100)");
            Double avgDisk = prometheusClient.queryMetric("avg(1 - (node_filesystem_avail_bytes{mountpoint=\"/data\"} / node_filesystem_size_bytes{mountpoint=\"/data\"})) * 100");
            
            // Total Network Load in Mbps (Receive + Transmit)
            Double totalNetRx = prometheusClient.queryMetric("sum(rate(node_network_receive_bytes_total{device!~\"lo\"}[5m]))");
            Double totalNetTx = prometheusClient.queryMetric("sum(rate(node_network_transmit_bytes_total{device!~\"lo\"}[5m]))");
            double netLoadMbps = ((totalNetRx != null ? totalNetRx : 0.0) + (totalNetTx != null ? totalNetTx : 0.0)) * 8 / 1000000.0;

            double cpuOver = Math.max(0, (avgCpu != null ? avgCpu : 0.0) - 80);
            double ramOver = Math.max(0, (avgRam != null ? avgRam : 0.0) - 85);
            double diskOver = Math.max(0, (avgDisk != null ? avgDisk : 0.0) - 90);
            double resourcePenalty = (cpuOver + ramOver + diskOver) * 8;

            double stability = 100 - (errorPenalty * 0.6 + resourcePenalty * 0.3 + 0.0);
            stability = Math.max(0.0, Math.min(100.0, stability));

            double previous = lastStabilityScore.getAndSet(stability);
            double trend = stability - previous;

            return StabilityResponse.builder()
                    .avgStability(stability)
                    .trend(trend)
                    .totalEnvironments(totalEnvs)
                    .activeAgents(activeNodes)
                    .networkLoad(netLoadMbps)
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
        List<com.monetique.eye.entity.Cluster> clusters = clusterRepository.findAll();
        List<TopologyData.ClusterGroup> clusterGroups = new ArrayList<>();
        List<TopologyData.TopologyNode> allNodesFlat = new ArrayList<>();
        List<TopologyData.TopologyEdge> allEdgesFlat = new ArrayList<>();

        for (com.monetique.eye.entity.Cluster cluster : clusters) {
            List<TopologyData.EnvironmentGroup> envGroups = new ArrayList<>();
            for (Environment env : cluster.getEnvironments()) {
                TopologyData envTopology = getTopologyForEnvironment(env);
                envGroups.add(TopologyData.EnvironmentGroup.builder()
                        .id(env.getId())
                        .name(env.getName())
                        .prometheusLabel(env.getPrometheusLabel())
                        .nodes(envTopology.getNodes())
                        .build());
                
                allNodesFlat.addAll(envTopology.getNodes());
                allEdgesFlat.addAll(envTopology.getEdges());
            }
            
            clusterGroups.add(TopologyData.ClusterGroup.builder()
                    .id(cluster.getId())
                    .name(cluster.getName())
                    .description(cluster.getDescription())
                    .environments(envGroups)
                    .build());
        }

        // Handle environments without a cluster (Orphan environments)
        List<Environment> orphanEnvs = environmentRepository.findAll().stream()
                .filter(env -> env.getCluster() == null)
                .collect(Collectors.toList());
        
        if (!orphanEnvs.isEmpty()) {
            List<TopologyData.EnvironmentGroup> orphanEnvGroups = new ArrayList<>();
            for (Environment env : orphanEnvs) {
                TopologyData envTopology = getTopologyForEnvironment(env);
                orphanEnvGroups.add(TopologyData.EnvironmentGroup.builder()
                        .id(env.getId())
                        .name(env.getName())
                        .prometheusLabel(env.getPrometheusLabel())
                        .nodes(envTopology.getNodes())
                        .build());
                allNodesFlat.addAll(envTopology.getNodes());
                allEdgesFlat.addAll(envTopology.getEdges());
            }
            clusterGroups.add(TopologyData.ClusterGroup.builder()
                    .id(0L)
                    .name("Ungrouped Environments")
                    .description("Environments not assigned to any cluster")
                    .environments(orphanEnvGroups)
                    .build());
        }

        return TopologyData.builder()
                .clusters(clusterGroups)
                .nodes(allNodesFlat)
                .edges(allEdgesFlat)
                .build();
    }

    public Map<String, Object> getEnvironmentHeatmap(Long environmentId) {
        Environment env = environmentRepository.findById(environmentId)
                .orElseThrow(() -> new RuntimeException("Environment not found"));
        
        List<ServiceResourceDTO> resources = getEnvironmentServiceResources(environmentId);
        
        // Group by Node
        Map<String, List<ServiceResourceDTO>> nodeGroups = resources.stream()
                .collect(Collectors.groupingBy(ServiceResourceDTO::getNodeName));
                
        List<Map<String, Object>> nodeHeatmap = new ArrayList<>();
        
        for (Map.Entry<String, List<ServiceResourceDTO>> entry : nodeGroups.entrySet()) {
            String nodeName = entry.getKey();
            List<ServiceResourceDTO> nodeResources = entry.getValue();
            
            double maxCpu = nodeResources.stream().mapToDouble(ServiceResourceDTO::getCpuUsagePercent).max().orElse(0.0);
            double maxRam = nodeResources.stream().mapToDouble(ServiceResourceDTO::getMemoryUsagePercent).max().orElse(0.0);
            boolean hasCritical = nodeResources.stream().anyMatch(r -> "CRITICAL".equals(r.getStatus()));
            
            // Risk score formula: weighted average of peaks and status
            double riskScore = (maxCpu * 0.4) + (maxRam * 0.4) + (hasCritical ? 20 : 0);
            riskScore = Math.min(100, riskScore);
            
            nodeHeatmap.add(Map.of(
                "id", nodeName,
                "riskScore", Math.round(riskScore),
                "status", hasCritical ? "CRITICAL" : (riskScore > 70 ? "WARNING" : "HEALTHY"),
                "containerCount", nodeResources.size()
            ));
        }
        
        return Map.of(
            "environmentId", environmentId,
            "nodes", nodeHeatmap
        );
    }

    private TopologyData getTopologyForEnvironment(Environment env) {
        List<TopologyData.TopologyNode> nodes = new ArrayList<>();
        List<TopologyData.TopologyEdge> edges = new ArrayList<>();
        String envFilter = buildEnvFilter(env);
        List<Map<String, Object>> instances = prometheusClient.queryList(String.format("up{environment=~\"%s\", job=\"node-exporter\"}", envFilter));
        
        java.util.Set<String> processedIps = new java.util.HashSet<>();
        int agentCount = 1;

        for (Map<String, Object> nodeMap : instances) {
            Map<String, String> metric = (Map<String, String>) nodeMap.get("metric");
            String instance = metric.get("instance");
            String ip = instance.split(":")[0];

            if (processedIps.contains(ip)) continue;
            processedIps.add(ip);

            String nodeInstance = ip + ":9100";
            Object upVal = nodeMap.get("value");
            boolean isUp = upVal != null && "1".equals(upVal.toString());

            Double cpu = isUp ? prometheusClient.getCpuUsageForInstance(nodeInstance) : 0.0;
            Double ram = isUp ? prometheusClient.getMemoryUsagePercentForInstance(nodeInstance) : 0.0;
            Double disk = isUp ? prometheusClient.queryMetric(String.format(
                "max(1 - ((node_filesystem_avail_bytes{instance=~\"%s.*\", mountpoint=\"/data\"} or ignoring(mountpoint, device, fstype) node_filesystem_avail_bytes{instance=~\"%s.*\", mountpoint=\"/\"}) / " +
                "(node_filesystem_size_bytes{instance=~\"%s.*\", mountpoint=\"/data\"} or ignoring(mountpoint, device, fstype) node_filesystem_size_bytes{instance=~\"%s.*\", mountpoint=\"/\"}))) * 100", 
                ip, ip, ip, ip)) : 0.0;
            if (disk == null) disk = 0.0;

            if (isUp && (cpu == 0.0 || ram == 0.0)) {
                cpu = prometheusClient.queryMetric(String.format("avg(1 - rate(node_cpu_seconds_total{mode=\"idle\", instance=~\"%s.*\"}[5m])) * 100", ip));
                ram = prometheusClient.queryMetric(String.format("(1 - (node_memory_MemAvailable_bytes{instance=~\"%s.*\"} / node_memory_MemTotal_bytes{instance=~\"%s.*\"})) * 100", ip, ip));
            }

            String status = isUp ? "HEALTHY" : "OFFLINE";
            if (isUp) {
                if (cpu > 90 || ram > 90) status = "CRITICAL";
                else if (cpu > 80 || ram > 85) status = "WARNING";
            }

            String nodeLabel = metric.get("nodename");
            boolean isCentralNode = ip.equals(env.getCentralNodeIp()) || 
                                   ip.equalsIgnoreCase("node-exporter") || 
                                   ip.equalsIgnoreCase("localhost") ||
                                   ip.equalsIgnoreCase("backend") ||
                                   ip.equalsIgnoreCase("central-node");

            if (nodeLabel == null || nodeLabel.isEmpty()) {
                if (isCentralNode) nodeLabel = env.getName();
                else nodeLabel = "node-" + ip.substring(ip.lastIndexOf('.') + 1);
            }

            nodes.add(TopologyData.TopologyNode.builder()
                    .id(isCentralNode ? "node-global-central" : "node-" + env.getId() + "-" + ip.replace(".", "-"))
                    .label(nodeLabel)
                    .ip(isCentralNode && env.getCentralNodeIp() != null ? env.getCentralNodeIp() : ip)
                    .type(isCentralNode ? "db-server" : "server")
                    .cpu(cpu.intValue())
                    .ram(ram.intValue())
                    .disk(disk.intValue())
                    .status(status)
                    .environmentId(env.getId())
                    .environmentName(env.getName())
                    .build());
        }

        String centralId = null;
        for (TopologyData.TopologyNode node : nodes) {
            if (env.getCentralNodeIp() != null && env.getCentralNodeIp().equals(node.getIp())) {
                centralId = node.getId();
                break;
            } else if (env.getCentralNodeIp() == null && (node.getIp().equalsIgnoreCase("node-exporter") || node.getIp().equalsIgnoreCase("central-node"))) {
                centralId = node.getId();
                break;
            }
        }

        if (centralId != null) {
            for (TopologyData.TopologyNode node : nodes) {
                if (!node.getId().equals(centralId)) {
                    edges.add(TopologyData.TopologyEdge.builder().source(node.getId()).target(centralId).build());
                }
            }
        }

        return TopologyData.builder().nodes(nodes).edges(edges).build();
    }

    public List<ServiceResourceDTO> getEnvironmentServiceResources(Long environmentId) {
        Environment env = environmentRepository.findById(environmentId)
                .orElseThrow(() -> new RuntimeException("Environment not found"));
        String envFilter = buildEnvFilter(env);

        List<Map<String, Object>> cpuData = prometheusClient.getContainerCpuUsage(envFilter);
        List<Map<String, Object>> memData = prometheusClient.getContainerMemoryUsage(envFilter);
        List<Map<String, Object>> netRxData = prometheusClient.getContainerNetworkRx(envFilter);
        List<Map<String, Object>> netTxData = prometheusClient.getContainerNetworkTx(envFilter);
        List<Map<String, Object>> ioReadData = prometheusClient.getContainerDiskRead(envFilter);
        List<Map<String, Object>> ioWriteData = prometheusClient.getContainerDiskWrite(envFilter);
        List<Map<String, Object>> startTimeData = prometheusClient.getContainerStartTimes(envFilter);
        List<Map<String, Object>> restartData = prometheusClient.getContainerRestartCounts(envFilter);
        List<Map<String, Object>> lastSeenData = prometheusClient.getContainerLastSeen(envFilter);

        List<Map<String, Object>> hostCpuData = prometheusClient.getHostTotalCpu(envFilter);
        List<Map<String, Object>> hostMemData = prometheusClient.getHostTotalMemory(envFilter);

        List<Map<String, Object>> nodeMetadata = prometheusClient.queryList("up{nodename!=\"\"}");
        Map<String, String> nodeNameMap = new java.util.HashMap<>();
        for (Map<String, Object> m : nodeMetadata) {
            Map<String, String> metric = (Map<String, String>) m.get("metric");
            String inst = metric.get("instance");
            String nodename = metric.get("nodename");
            if (nodename != null && !nodename.isEmpty()) {
                nodeNameMap.put(inst, nodename);
                nodeNameMap.put(inst.split(":")[0], nodename);
            }
        }

        // Precision mapping for management node synonyms
        if (env.getName() != null && (env.getName().contains("central") || env.getName().contains("eye"))) {
            nodeNameMap.put("cadvisor", env.getName());
            nodeNameMap.put("node-exporter", env.getName());
            nodeNameMap.put("localhost", env.getName());
            nodeNameMap.put("backend", env.getName());
        }

        Map<String, Double> hostCpuMap = new java.util.HashMap<>();
        for (Map<String, Object> m : hostCpuData) {
            String inst = ((Map<String, String>) m.get("metric")).get("instance");
            hostCpuMap.put(inst.split(":")[0], Double.parseDouble(m.get("value").toString()));
        }

        Map<String, Double> hostMemMap = new java.util.HashMap<>();
        for (Map<String, Object> m : hostMemData) {
            String inst = ((Map<String, String>) m.get("metric")).get("instance");
            hostMemMap.put(inst.split(":")[0], Double.parseDouble(m.get("value").toString()));
        }

        // Bridge cadvisor instance names to host resources for central node
        if (hostCpuMap.containsKey("node-exporter")) {
            hostCpuMap.put("cadvisor", hostCpuMap.get("node-exporter"));
            hostCpuMap.put("localhost", hostCpuMap.get("node-exporter"));
        }
        if (hostMemMap.containsKey("node-exporter")) {
            hostMemMap.put("cadvisor", hostMemMap.get("node-exporter"));
            hostMemMap.put("localhost", hostMemMap.get("node-exporter"));
        }

        Map<String, ServiceResourceDTO.ServiceResourceDTOBuilder> builders = new java.util.HashMap<>();
        
        // 1. Calculate the most recent "Now" per instance to avoid isolation leakage
        Map<String, Long> instanceNowMap = new java.util.HashMap<>();
        long clusterMaxTs = 0;
        for (Map<String, Object> m : lastSeenData) {
            String inst = ((Map<String, String>) m.get("metric")).get("instance");
            Object tsObj = m.get("timestamp");
            if (tsObj != null) {
                long ts = (long) Double.parseDouble(tsObj.toString());
                instanceNowMap.merge(inst, ts, Math::max);
                if (ts > clusterMaxTs) clusterMaxTs = ts;
            }
        }
        final long prometheusNow = clusterMaxTs > 0 ? clusterMaxTs : (System.currentTimeMillis() / 1000);

        // 1. Initialize builders from Liveness Data (Inventory Source of Truth)
        for (Map<String, Object> m : lastSeenData) {
            Map<String, String> metric = (Map<String, String>) m.get("metric");
            String serviceName = resolveServiceName(metric);
            if ("unknown-service".equals(serviceName)) continue;

            String inst = metric.get("instance");
            String key = serviceName + "@" + inst;
            long lastSeen = (long) Double.parseDouble(m.get("value").toString());
            
            String displayNode = nodeNameMap.getOrDefault(inst.split(":")[0], inst.split(":")[0]);
            
            String initialStatus = "HEALTHY";
            String reason = null;
            long nodeNow = instanceNowMap.getOrDefault(inst, prometheusNow);
            long delta = nodeNow - lastSeen;
            
            if (delta > 120) {
                initialStatus = "CRITICAL";
                reason = String.format("Container stopped (Stale by %ds)", delta);
            }

            builders.put(key, ServiceResourceDTO.builder()
                    .serviceName(serviceName)
                    .nodeName(displayNode)
                    .status(initialStatus)
                    .healthReason(reason));
        }

        // 2. Populate Resource Metrics (CPU, MEM, etc.)
        for (Map<String, Object> m : cpuData) {
            String key = metricToKey(m);
            Map<String, String> metric = (Map<String, String>) m.get("metric");
            String inst = metric.get("instance");
            
            double cpuAbs = Double.parseDouble(m.get("value").toString());
            double hostTotal = hostCpuMap.getOrDefault(inst.split(":")[0], 1.0);
            double cpuPercent = (cpuAbs / hostTotal) * 100.0;
            
            builders.computeIfPresent(key, (k, b) -> b.cpuUsageCores(cpuAbs).cpuUsagePercent(cpuPercent));
        }

        for (Map<String, Object> m : memData) {
            String key = metricToKey(m);
            Map<String, String> metric = (Map<String, String>) m.get("metric");
            String inst = metric.get("instance");
            
            long memAbs = (long) Double.parseDouble(m.get("value").toString());
            double hostTotal = hostMemMap.getOrDefault(inst.split(":")[0], 1024.0 * 1024.0 * 1024.0);
            double memPercent = ((double) memAbs / hostTotal) * 100.0;

            builders.computeIfPresent(key, (k, b) -> b.memoryUsageBytes(memAbs).memoryUsagePercent(memPercent));
        }

        for (Map<String, Object> m : ioReadData) builders.computeIfPresent(metricToKey(m), (k, b) -> b.diskReadBytesPerSec(Double.parseDouble(m.get("value").toString())));
        for (Map<String, Object> m : ioWriteData) builders.computeIfPresent(metricToKey(m), (k, b) -> b.diskWriteBytesPerSec(Double.parseDouble(m.get("value").toString())));
        for (Map<String, Object> m : netRxData) builders.computeIfPresent(metricToKey(m), (k, b) -> b.networkRxBytesPerSec(Double.parseDouble(m.get("value").toString())));
        for (Map<String, Object> m : netTxData) builders.computeIfPresent(metricToKey(m), (k, b) -> b.networkTxBytesPerSec(Double.parseDouble(m.get("value").toString())));

        for (Map<String, Object> m : startTimeData) {
            String key = metricToKey(m);
            Object val = m.get("value");
            if (val != null) {
                Map<String, String> metric = (Map<String, String>) m.get("metric");
                String inst = metric.get("instance");
                long nodeNow = instanceNowMap.getOrDefault(inst, prometheusNow);
                long startTime = (long) Double.parseDouble(val.toString());
                builders.computeIfPresent(key, (k, b) -> b.uptimeSeconds(nodeNow - startTime));
            }
        }

        for (Map<String, Object> m : restartData) {
            String key = metricToKey(m);
            Object val = m.get("value");
            if (val != null) {
                int restarts = (int) Double.parseDouble(val.toString());
                builders.computeIfPresent(key, (k, b) -> b.restartCount(restarts));
            }
        }

        List<ServiceResourceDTO> services = builders.values().stream().map(b -> {
            ServiceResourceDTO dto = b.build();
            // Resource Threshold Logic (Only upgrade status, never downgrade CRITICAL/Stopped states)
            if (!"CRITICAL".equals(dto.getStatus())) {
                if (dto.getCpuUsagePercent() > 80 || dto.getMemoryUsagePercent() > 80) dto.setStatus("CRITICAL");
                else if (dto.getCpuUsagePercent() > 60 || dto.getMemoryUsagePercent() > 60) dto.setStatus("WARNING");
            }
            return dto;
        }).collect(Collectors.toList());

        // ==================================================================
        // Collect existing service keys for cross-source deduplication
        // ==================================================================
        java.util.Set<String> existingServiceKeys = services.stream()
                .map(s -> s.getServiceName().toLowerCase() + "@" + s.getNodeName().toLowerCase())
                .collect(Collectors.toCollection(java.util.HashSet::new));

        // ==================================================================
        // Dynamic Systemd Service Discovery (Broad — no hardcoded name list)
        // ==================================================================
        try {
            List<Map<String, Object>> systemdActiveData = prometheusClient.queryList(
                    String.format("node_systemd_unit_state{environment=~\"%s\", name=~\".*\\\\.service\", state=\"active\"} == 1", envFilter));

            List<Map<String, Object>> systemdFailedData = prometheusClient.queryList(
                    String.format("node_systemd_unit_state{environment=~\"%s\", name=~\".*\\\\.service\", state=\"failed\"} == 1", envFilter));

            // System-level noise to exclude
            java.util.Set<String> systemdNoise = java.util.Set.of(
                    "systemd-journald", "systemd-logind", "systemd-udevd", "systemd-resolved",
                    "systemd-timesyncd", "systemd-networkd", "systemd-tmpfiles-setup",
                    "systemd-remount-fs", "systemd-sysctl", "systemd-modules-load",
                    "systemd-random-seed", "systemd-update-utmp", "dbus", "dbus-broker",
                    "getty@tty1", "serial-getty@ttyS0", "user@0", "user-runtime-dir@0",
                    "ifup@eth0", "networking", "rsyslog", "kmod-static-nodes",
                    "lvm2-monitor", "multipathd", "polkit", "accounts-daemon",
                    "ModemManager", "udisks2", "packagekit", "console-setup",
                    "keyboard-setup", "apparmor", "blk-availability", "setvtrgb"
            );

            java.util.Set<String> processedKeys = new java.util.HashSet<>();

            // Parse failed units first to prioritize CRITICAL statuses
            for (Map<String, Object> m : systemdFailedData) {
                Map<String, String> metric = (Map<String, String>) m.get("metric");
                if (metric == null) continue;
                String serviceNameRaw = metric.get("name");
                String serviceName = serviceNameRaw != null ? serviceNameRaw.replace(".service", "") : "unknown";
                if (systemdNoise.contains(serviceName)) continue;
                String inst = metric.get("instance");
                if (inst == null) continue;
                String displayNode = nodeNameMap.getOrDefault(inst.split(":")[0], inst.split(":")[0]);
                String key = serviceName.toLowerCase() + "@" + displayNode.toLowerCase();
                if (existingServiceKeys.contains(key)) continue;

                services.add(ServiceResourceDTO.builder()
                        .serviceName(serviceName)
                        .nodeName(displayNode)
                        .containerId("systemd")
                        .status("CRITICAL")
                        .healthReason("Systemd service in FAILED state")
                        .build());
                processedKeys.add(key);
                existingServiceKeys.add(key);
            }

            // Parse active units next
            for (Map<String, Object> m : systemdActiveData) {
                Map<String, String> metric = (Map<String, String>) m.get("metric");
                if (metric == null) continue;
                String serviceNameRaw = metric.get("name");
                String serviceName = serviceNameRaw != null ? serviceNameRaw.replace(".service", "") : "unknown";
                if (systemdNoise.contains(serviceName)) continue;
                String inst = metric.get("instance");
                if (inst == null) continue;
                String displayNode = nodeNameMap.getOrDefault(inst.split(":")[0], inst.split(":")[0]);
                String key = serviceName.toLowerCase() + "@" + displayNode.toLowerCase();
                if (existingServiceKeys.contains(key) || processedKeys.contains(key)) continue;

                services.add(ServiceResourceDTO.builder()
                        .serviceName(serviceName)
                        .nodeName(displayNode)
                        .containerId("systemd")
                        .status("HEALTHY")
                        .build());
                processedKeys.add(key);
                existingServiceKeys.add(key);
            }
        } catch (Exception ex) {
            log.warn("Failed to discover systemd services: {}", ex.getMessage());
        }

        // ==================================================================
        // Prometheus Target Discovery (catch-all for any monitored service)
        // ==================================================================
        try {
            List<Map<String, Object>> targets = prometheusClient.getPrometheusTargets(envFilter);

            // Infrastructure jobs to skip (monitoring infra, not user services)
            java.util.Set<String> infraJobs = java.util.Set.of(
                    "node-exporter", "node_exporter", "cadvisor", "prometheus", "grafana",
                    "alertmanager", "pushgateway", "blackbox-exporter"
            );

            // Batch-fetch process-level resource metrics for non-container services
            Map<String, Double> processCpuMap = new java.util.HashMap<>();
            Map<String, Long> processMemMap = new java.util.HashMap<>();
            try {
                for (Map<String, Object> m : prometheusClient.getProcessCpuUsage(envFilter)) {
                    Map<String, String> metric = (Map<String, String>) m.get("metric");
                    String pKey = metric.getOrDefault("job", "") + "@" + metric.getOrDefault("instance", "");
                    Object val = m.get("value");
                    if (val != null) processCpuMap.put(pKey, Double.parseDouble(val.toString()));
                }
                for (Map<String, Object> m : prometheusClient.getProcessMemoryUsage(envFilter)) {
                    Map<String, String> metric = (Map<String, String>) m.get("metric");
                    String pKey = metric.getOrDefault("job", "") + "@" + metric.getOrDefault("instance", "");
                    Object val = m.get("value");
                    if (val != null) processMemMap.put(pKey, (long) Double.parseDouble(val.toString()));
                }
            } catch (Exception e) {
                log.debug("Process-level metrics not available: {}", e.getMessage());
            }

            for (Map<String, Object> target : targets) {
                Map<String, String> metric = (Map<String, String>) target.get("metric");
                if (metric == null) continue;

                String job = metric.get("job");
                if (job == null || infraJobs.contains(job.toLowerCase())) continue;

                String inst = metric.get("instance");
                if (inst == null) continue;

                String displayNode = nodeNameMap.getOrDefault(inst.split(":")[0], inst.split(":")[0]);
                String key = job.toLowerCase() + "@" + displayNode.toLowerCase();
                if (existingServiceKeys.contains(key)) continue;

                boolean isUp = target.get("value") != null && "1".equals(target.get("value").toString());

                // Enrich with process-level metrics if available
                String processKey = job + "@" + inst;
                double cpuCores = processCpuMap.getOrDefault(processKey, 0.0);
                long memBytes = processMemMap.getOrDefault(processKey, 0L);
                double hostTotalCpu = hostCpuMap.getOrDefault(inst.split(":")[0], 1.0);
                double cpuPercent = hostTotalCpu > 0 ? (cpuCores / hostTotalCpu) * 100.0 : 0.0;
                double hostTotalMem = hostMemMap.getOrDefault(inst.split(":")[0], 1024.0 * 1024.0 * 1024.0);
                double memPercent = hostTotalMem > 0 ? ((double) memBytes / hostTotalMem) * 100.0 : 0.0;

                String status = isUp ? "HEALTHY" : "CRITICAL";
                if (isUp && (cpuPercent > 80 || memPercent > 80)) status = "CRITICAL";
                else if (isUp && (cpuPercent > 60 || memPercent > 60)) status = "WARNING";

                services.add(ServiceResourceDTO.builder()
                        .serviceName(job)
                        .nodeName(displayNode)
                        .containerId("process")
                        .status(status)
                        .healthReason(isUp ? null : "Service endpoint unreachable")
                        .cpuUsageCores(cpuCores)
                        .cpuUsagePercent(cpuPercent)
                        .memoryUsageBytes(memBytes)
                        .memoryUsagePercent(memPercent)
                        .build());
                existingServiceKeys.add(key);
            }
        } catch (Exception ex) {
            log.warn("Failed to discover Prometheus targets: {}", ex.getMessage());
        }

        // ==================================================================
        // Managed Node Fallback (host-level entries for nodes with no services)
        // ==================================================================
        try {
            List<com.monetique.eye.entity.ManagedNode> managedNodes = managedNodeRepository.findByEnvironment(env);
            
            // Collect node display names that already have services
            java.util.Set<String> coveredNodes = services.stream()
                    .map(s -> s.getNodeName().toLowerCase())
                    .collect(Collectors.toSet());
            
            for (com.monetique.eye.entity.ManagedNode node : managedNodes) {
                String nodeIp = node.getIp();
                String displayNode = nodeNameMap.getOrDefault(nodeIp, 
                        node.getNodeName() != null ? node.getNodeName() : nodeIp);
                
                if (coveredNodes.contains(displayNode.toLowerCase()) || coveredNodes.contains(nodeIp.toLowerCase())) {
                    continue;
                }
                
                // Query host-level metrics for this node
                String nodeInstance = nodeIp + ":" + (node.getNodeExporterPort() != null ? node.getNodeExporterPort() : 9100);
                Double hostCpu = prometheusClient.getCpuUsageForInstance(nodeInstance);
                Double hostMem = prometheusClient.getMemoryUsagePercentForInstance(nodeInstance);
                boolean isReachable = hostCpu != null && hostCpu > 0;
                
                // Check if node-exporter is up
                if (!isReachable) {
                    Double upVal = prometheusClient.queryMetric(
                            String.format("up{instance=~\"%s.*\", job=\"node-exporter\"}", nodeIp));
                    isReachable = upVal != null && upVal > 0;
                }
                
                double cpuVal = hostCpu != null ? hostCpu : 0.0;
                double memVal = hostMem != null ? hostMem : 0.0;
                
                String status = isReachable ? "HEALTHY" : "CRITICAL";
                if (isReachable && (cpuVal > 90 || memVal > 90)) status = "CRITICAL";
                else if (isReachable && (cpuVal > 80 || memVal > 85)) status = "WARNING";
                
                services.add(ServiceResourceDTO.builder()
                        .serviceName("Host: " + displayNode)
                        .nodeName(displayNode)
                        .containerId("host")
                        .status(status)
                        .healthReason(isReachable ? null : "Node unreachable — no metrics received")
                        .cpuUsageCores(cpuVal / 100.0) // approximate
                        .cpuUsagePercent(cpuVal)
                        .memoryUsagePercent(memVal)
                        .build());
            }
        } catch (Exception ex) {
            log.warn("Failed managed node fallback discovery: {}", ex.getMessage());
        }

        return services;

    }

    private String buildEnvFilter(Environment env) {
        java.util.Set<String> variants = new java.util.HashSet<>();
        
        String label = env.getPrometheusLabel();
        if (label != null && !label.isEmpty()) {
            variants.add(label);
        }
        
        String name = env.getName();
        if (name != null && !name.isEmpty()) {
            variants.add(name);
            
            // Add infrastructure synonyms for known management node patterns
            String lowerName = name.toLowerCase();
            if (lowerName.contains("central") || lowerName.contains("eye") || lowerName.contains("vmpipe")) {
                variants.add("central-node");
                variants.add("vmpipe");
                variants.add("localhost");
            }
        }
        
        return String.join("|", variants);
    }

    private String resolveServiceName(Map<String, String> metric) {
        String service = metric.get("container_label_com_docker_compose_service");
        if (service == null || service.isEmpty()) {
            service = metric.get("name");
            if (service != null && service.startsWith("/")) {
                service = service.substring(1);
            }
        }
        return (service != null && !service.isEmpty()) ? service : "unknown-service";
    }

    private String metricToKey(Map<String, Object> m) {
        Map<String, String> metric = (Map<String, String>) m.get("metric");
        return resolveServiceName(metric) + "@" + metric.get("instance");
    }

    public List<IncidentDTO> getEnvironmentIncidents(Long environmentId) {
        Environment env = environmentRepository.findById(environmentId)
                .orElseThrow(() -> new RuntimeException("Environment not found"));

        String rawLabel = env.getPrometheusLabel();
        final String envLabel = (rawLabel == null || rawLabel.isEmpty()) ? env.getSafeName() : rawLabel;
        List<Map<String, Object>> rawAlerts = prometheusClient.getActiveAlerts();

        return rawAlerts.stream()
                .filter(alert -> {
                    Map<String, String> labels = (Map<String, String>) alert.get("labels");
                    return labels != null && (envLabel.equals(labels.get("environment")) || envLabel.equals(labels.get("container_label_env")));
                })
                .map(alert -> {
                    Map<String, String> labels = (Map<String, String>) alert.get("labels");
                    Map<String, String> annotations = (Map<String, String>) alert.get("annotations");
                    
                    String activeAtStr = (String) alert.get("activeAt");
                    LocalDateTime activeAt = LocalDateTime.now();
                    try {
                        activeAt = ZonedDateTime.parse(activeAtStr).toLocalDateTime();
                    } catch (Exception e) {}

                    String instance = labels.get("instance");
                    if (instance != null && instance.contains(":")) {
                        instance = instance.substring(0, instance.lastIndexOf(":"));
                    }

                    return IncidentDTO.builder()
                            .alertName(labels.get("alertname"))
                            .severity(labels.getOrDefault("severity", "warning"))
                            .instance(instance)
                            .state((String) alert.get("state"))
                            .summary(annotations != null ? annotations.get("summary") : "No summary available")
                            .description(annotations != null ? annotations.get("description") : "")
                            .activeAt(activeAt)
                            .labels(labels)
                            .build();
                })
                .collect(Collectors.toList());
    }
}
