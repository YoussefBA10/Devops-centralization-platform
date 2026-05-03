package com.monetique.eye.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.monetique.eye.entity.ManagedNode;
import com.monetique.eye.entity.ServiceLink;
import com.monetique.eye.repository.ManagedNodeRepository;
import com.monetique.eye.repository.ServiceLinkRepository;
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

    private final ManagedNodeRepository managedNodeRepository;
    private final ServiceLinkRepository serviceLinkRepository;
    private final NetworkMetricsProxyService metricsProxyService;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${monitoring.alertmanager.base-url:http://localhost:9093}")
    private String alertmanagerBaseUrl;

    public TopologyGraph buildTopologyGraph(Long clusterId, Long envId) {
        List<ManagedNode> nodesList;
        List<ServiceLink> links;
        List<NetworkMetricsProxyService.LinkHealthSummary> healthSummaries;

        if (envId != null) {
            nodesList = managedNodeRepository.findByEnvironment_Cluster_IdAndEnvironment_Id(clusterId, envId);
            links = serviceLinkRepository.findByClusterIdAndEnvironmentId(clusterId, envId);
            healthSummaries = metricsProxyService.getHealthSummary(clusterId, envId);
        } else if (clusterId != null) {
            nodesList = managedNodeRepository.findByEnvironment_Cluster_Id(clusterId);
            links = serviceLinkRepository.findByClusterId(clusterId);
            healthSummaries = metricsProxyService.getHealthSummary(clusterId, null);
        } else {
            nodesList = managedNodeRepository.findAll();
            links = serviceLinkRepository.findAll();
            healthSummaries = metricsProxyService.getHealthSummary(null, null);
        }

        Map<String, NetworkMetricsProxyService.LinkHealthSummary> healthMap = healthSummaries.stream()
                .collect(Collectors.toMap(NetworkMetricsProxyService.LinkHealthSummary::getLinkId, s -> s));

        Map<String, Integer> nodeAlertCounts = getActiveAlertCountsByNode();

        List<TopologyNode> nodes = new ArrayList<>();
        for (ManagedNode node : nodesList) {
            int alertCount = nodeAlertCounts.getOrDefault(String.valueOf(node.getId()), 0);
            String status = alertCount > 0 ? "WARNING" : "HEALTHY";
            
            nodes.add(TopologyNode.builder()
                    .id(String.valueOf(node.getId()))
                    .label(node.getNodeName() != null ? node.getNodeName() : node.getIp())
                    .role(node.getRole())
                    .ip(node.getIp())
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
                    .source(String.valueOf(link.getSourceNode().getId()))
                    .target(String.valueOf(link.getTargetNode().getId()))
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

    private Map<String, Integer> getActiveAlertCountsByNode() {
        Map<String, Integer> counts = new HashMap<>();
        try {
            String url = alertmanagerBaseUrl + "/api/v2/alerts?filter=job=~\"blackbox_probe|node_exporter|cadvisor|app_metrics.*\"";
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            JsonNode root = objectMapper.readTree(response.getBody());
            
            if (root.isArray()) {
                for (JsonNode alert : root) {
                    if ("active".equals(alert.path("status").path("state").asText())) {
                        String nodeId = alert.path("labels").path("node_id").asText(null);
                        if (nodeId == null) {
                            nodeId = alert.path("labels").path("target_node").asText(null);
                        }
                        if (nodeId != null) {
                            counts.put(nodeId, counts.getOrDefault(nodeId, 0) + 1);
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
