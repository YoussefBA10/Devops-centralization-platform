package com.monetique.eye.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.monetique.eye.entity.ServiceLink;
import com.monetique.eye.entity.VmRegistry;
import com.monetique.eye.repository.ServiceLinkRepository;
import com.monetique.eye.repository.VmRegistryRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class NetworkTopologyService {

    private final VmRegistryRepository vmRegistryRepository;
    private final ServiceLinkRepository serviceLinkRepository;
    private final NetworkMetricsProxyService metricsProxyService;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${monitoring.alertmanager.base-url:http://localhost:9093}")
    private String alertmanagerBaseUrl;

    public TopologyGraph buildTopologyGraph(Long clusterId, String env) {
        List<VmRegistry> vms = vmRegistryRepository.findByClusterIdAndEnv(clusterId, env);
        List<ServiceLink> links = serviceLinkRepository.findByClusterIdAndEnv(clusterId, env);
        List<NetworkMetricsProxyService.LinkHealthSummary> healthSummaries = metricsProxyService.getHealthSummary(clusterId, env);

        Map<String, NetworkMetricsProxyService.LinkHealthSummary> healthMap = healthSummaries.stream()
                .collect(Collectors.toMap(NetworkMetricsProxyService.LinkHealthSummary::getLinkId, s -> s));

        Map<String, Integer> vmAlertCounts = getActiveAlertCountsByVm();

        List<TopologyNode> nodes = new ArrayList<>();
        for (VmRegistry vm : vms) {
            int alertCount = vmAlertCounts.getOrDefault(vm.getId(), 0);
            String status = alertCount > 0 ? "WARNING" : "HEALTHY";
            // Check if any critical alerts exist (simplified here: if > 0, assume warning, if high count maybe critical. 
            // Better yet, real alert parsing would check severity. Let's stick to WARNING/HEALTHY based on count as spec is simple).
            
            nodes.add(TopologyNode.builder()
                    .id(vm.getId())
                    .label(vm.getName() != null ? vm.getName() : vm.getIpAddress())
                    .role(vm.getRole())
                    .ip(vm.getIpAddress())
                    .status(status)
                    .alertCount(alertCount)
                    .build());
        }

        List<TopologyEdge> edges = new ArrayList<>();
        for (ServiceLink link : links) {
            if (!link.getEnabled()) continue;
            
            NetworkMetricsProxyService.LinkHealthSummary health = healthMap.get(link.getId());
            String status = health != null ? health.getStatus() : "UNKNOWN";
            double latency = health != null ? health.getCurrentLatencyMs() : 0.0;

            edges.add(TopologyEdge.builder()
                    .id(link.getId())
                    .source(link.getSourceVm().getId())
                    .target(link.getTargetVm().getId())
                    .status(status)
                    .latencyMs(latency)
                    .protocol(link.getProtocol())
                    .probeModule(link.getProbeModule())
                    .build());
        }

        return TopologyGraph.builder()
                .nodes(nodes)
                .edges(edges)
                .build();
    }

    private Map<String, Integer> getActiveAlertCountsByVm() {
        Map<String, Integer> counts = new HashMap<>();
        try {
            String url = alertmanagerBaseUrl + "/api/v2/alerts?filter=job=~\"blackbox_probe|node_exporter|cadvisor|app_metrics.*\"";
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            JsonNode root = objectMapper.readTree(response.getBody());
            
            if (root.isArray()) {
                for (JsonNode alert : root) {
                    // Only count firing alerts
                    if ("active".equals(alert.path("status").path("state").asText())) {
                        String vmId = alert.path("labels").path("vm_id").asText(null);
                        if (vmId == null) {
                            // try to map from target_vm or source_vm if it's a link alert
                            vmId = alert.path("labels").path("target_vm").asText(null);
                        }
                        if (vmId != null) {
                            counts.put(vmId, counts.getOrDefault(vmId, 0) + 1);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch alerts from Alertmanager: {}", e.getMessage());
        }
        return counts;
    }

    @Data
    @Builder
    public static class TopologyGraph {
        private List<TopologyNode> nodes;
        private List<TopologyEdge> edges;
    }

    @Data
    @Builder
    public static class TopologyNode {
        private String id;
        private String label;
        private String role;
        private String ip;
        private String status;
        private int alertCount;
    }

    @Data
    @Builder
    public static class TopologyEdge {
        private String id;
        private String source;
        private String target;
        private String status;
        private double latencyMs;
        private String protocol;
        private String probeModule;
    }
}
