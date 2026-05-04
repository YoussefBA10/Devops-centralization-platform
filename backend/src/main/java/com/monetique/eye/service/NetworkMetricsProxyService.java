package com.monetique.eye.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.monetique.eye.entity.ServiceLink;
import com.monetique.eye.repository.ServiceLinkRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class NetworkMetricsProxyService {

    private final RestTemplate restTemplate;
    private final ServiceLinkRepository serviceLinkRepository;
    private final com.monetique.eye.repository.ManagedNodeRepository managedNodeRepository;
    private final ObjectMapper objectMapper;

    @Value("${prometheus.url:http://prometheus:9090}")
    private String metricsBaseUrl;

    public Map<String, Object> getLinkMetrics(String linkId, String range) {
        String step = getStep(range);
        String start = getStart(range);
        
        Map<String, Object> result = new HashMap<>();
        result.put("probeSuccess", queryRange("probe_success{link_id=\"" + linkId + "\"}", start, step));
        result.put("durationMs", queryRange("probe_duration_seconds{link_id=\"" + linkId + "\"} * 1000", start, step));
        result.put("statusCode", queryRange("probe_http_status_code{link_id=\"" + linkId + "\"}", start, step));
        result.put("connectMs", queryRange("probe_http_duration_seconds{phase=\"connect\",link_id=\"" + linkId + "\"} * 1000", start, step));
        result.put("processingMs", queryRange("probe_http_duration_seconds{phase=\"processing\",link_id=\"" + linkId + "\"} * 1000", start, step));
        
        return result;
    }

    public Map<String, Object> getVmNetworkMetrics(Long nodeId, String range) {
        String step = getStep(range);
        String start = getStart(range);
        
        String nodeFilter = resolveNodeFilter(nodeId);

        Map<String, Object> result = new HashMap<>();
        result.put("retransmitRate", queryRange("rate(node_netstat_Tcp_RetransSegs{" + nodeFilter + "}[5m])", start, step));
        result.put("dropRate", queryRange("rate(node_network_receive_drop_total{" + nodeFilter + "}[5m])", start, step));
        result.put("rxMbps", queryRange("rate(node_network_receive_bytes_total{" + nodeFilter + "}[5m]) * 8 / 1e6", start, step));
        result.put("txMbps", queryRange("rate(node_network_transmit_bytes_total{" + nodeFilter + "}[5m]) * 8 / 1e6", start, step));
        result.put("tcpEstab", queryRange("node_netstat_Tcp_CurrEstab{" + nodeFilter + "}", start, step));
        result.put("timeWait", queryRange("node_sockstat_TCP_tw{" + nodeFilter + "}", start, step));
        result.put("errors", queryRange("rate(node_network_receive_errs_total{" + nodeFilter + "}[5m])", start, step));
        
        return result;
    }

    public Map<String, Map<String, Object>> getVmContainerNetworkMetrics(Long nodeId, String range) {
        String step = getStep(range);
        String start = getStart(range);
        
        String nodeFilter = resolveNodeFilter(nodeId);

        JsonNode rxData = queryRange("rate(container_network_receive_bytes_total{" + nodeFilter + "}[5m]) * 8 / 1e6", start, step);
        JsonNode txData = queryRange("rate(container_network_transmit_bytes_total{" + nodeFilter + "}[5m]) * 8 / 1e6", start, step);
        JsonNode dropData = queryRange("rate(container_network_receive_dropped_total{" + nodeFilter + "}[5m])", start, step);

        Map<String, Map<String, Object>> containers = new HashMap<>();
        
        processContainerData(rxData, "rxMbps", containers);
        processContainerData(txData, "txMbps", containers);
        processContainerData(dropData, "drops", containers);

        return containers;
    }

    private void processContainerData(JsonNode metricData, String metricKey, Map<String, Map<String, Object>> containers) {
        if (metricData != null && metricData.has("result")) {
            for (JsonNode res : metricData.get("result")) {
                String containerName = res.path("metric").path("container_label_com_docker_compose_service").asText("unknown");
                if (containerName.equals("unknown")) {
                    containerName = res.path("metric").path("name").asText("unknown");
                }
                containers.computeIfAbsent(containerName, k -> new HashMap<>()).put(metricKey, res.get("values"));
            }
        }
    }

    public List<LinkHealthSummary> getHealthSummary(Long clusterId, Long envId) {
        List<ServiceLink> links;
        if (envId != null) {
            links = serviceLinkRepository.findByClusterIdAndEnvironmentId(clusterId, envId);
        } else if (clusterId != null) {
            links = serviceLinkRepository.findByClusterId(clusterId);
        } else {
            links = serviceLinkRepository.findAll();
        }
        List<LinkHealthSummary> summaries = new ArrayList<>();

        for (ServiceLink link : links) {
            if (!link.getEnabled()) continue;
            
            Double uptime = querySingleValue("avg_over_time(probe_success{link_id=\"" + link.getId() + "\"}[1h])");
            Double currentLatency = querySingleValue("probe_duration_seconds{link_id=\"" + link.getId() + "\"}");
            Double avgLatency = querySingleValue("avg_over_time(probe_duration_seconds{link_id=\"" + link.getId() + "\"}[1h])");
            Double maxLatency = querySingleValue("max_over_time(probe_duration_seconds{link_id=\"" + link.getId() + "\"}[1h])");
            Double errorRate = querySingleValue("(rate(probe_http_status_code{link_id=\"" + link.getId() + "\", status=~\"5..\"}[1h]) / rate(probe_http_status_code{link_id=\"" + link.getId() + "\"}[1h]))");

            String status = "UP";
            Double lastSuccess = querySingleValue("probe_success{link_id=\"" + link.getId() + "\"}");
            if (lastSuccess != null && lastSuccess == 0) {
                status = "DOWN";
            } else if (lastSuccess != null && lastSuccess == 1) {
                if ((currentLatency != null && currentLatency > 0.5) || (errorRate != null && errorRate > 0.01)) {
                    status = "DEGRADED";
                }
            } else if (lastSuccess == null) {
                status = "UNKNOWN";
            }

            summaries.add(LinkHealthSummary.builder()
                    .linkId(link.getId())
                    .linkName(link.getName())
                    .sourceNode(link.getSourceNode().getNodeName() != null ? link.getSourceNode().getNodeName() : link.getSourceNode().getIp())
                    .targetNode(link.getTargetNode().getNodeName() != null ? link.getTargetNode().getNodeName() : link.getTargetNode().getIp())
                    .targetPort(link.getTargetPort())
                    .protocol(link.getProtocol())
                    .status(status)
                    .currentLatencyMs(currentLatency != null ? currentLatency * 1000 : 0)
                    .avgLatencyMs(avgLatency != null ? avgLatency * 1000 : 0)
                    .maxLatencyMs(maxLatency != null ? maxLatency * 1000 : 0)
                    .uptimePercent(uptime != null ? uptime * 100 : 0)
                    .errorRate(errorRate != null ? errorRate * 100 : 0)
                    .lastChecked(new Date()) // Or fetch from metric timestamp
                    .build());
        }
        return summaries;
    }

    public Map<String, Object> checkExporterCollectors(Long nodeId) {
        String nodeFilter = resolveNodeFilter(nodeId);
        Double value = querySingleValue("node_netstat_Tcp_RetransSegs{" + nodeFilter + "}");
        Map<String, Object> result = new HashMap<>();
        if (value == null) {
            result.put("netstatAvailable", false);
            result.put("warning", "node_exporter on this VM was not started with --collector.netstat. TCP retransmission metrics are unavailable. To enable them, restart node_exporter with the flags: --collector.netstat --collector.tcpstat. Since you only have Docker group access, if node_exporter runs as a systemd service, ask a user with sudo access to restart it with these flags, or re-deploy it as a Docker container with the flags added.");
        } else {
            result.put("netstatAvailable", true);
        }
        return result;
    }

    private String resolveNodeFilter(Long nodeId) {
        return managedNodeRepository.findById(nodeId)
                .map(node -> {
                    String ip = node.getIp();
                    if (ip == null) return "instance=\"unknown\"";
                    
                    // CLEAN IP ON THE FLY
                    String cleanIp = ip.replaceAll("^https?://", "").replaceAll("/", "").replaceAll("http", "");
                    
                    if (cleanIp.equals("127.0.0.1") || cleanIp.equals("localhost") || cleanIp.equals("central-node")) {
                        return "instance=~\"localhost:.*|node-exporter:.*|central-node:.*\"";
                    }
                    return "instance=~\"" + cleanIp + ":.*\"";
                })
                .orElse("node_id=\"" + nodeId + "\""); // Fallback
    }

    private JsonNode queryRange(String query, String startStr, String step) {
        try {
            long end = System.currentTimeMillis() / 1000;
            long start;
            
            if (startStr.startsWith("now-")) {
                String duration = startStr.substring(4);
                long seconds = parseDurationToSeconds(duration);
                start = end - seconds;
            } else {
                start = end - 3600; // default 1h
            }

            java.net.URI uri = UriComponentsBuilder.fromHttpUrl(metricsBaseUrl + "/api/v1/query_range")
                    .queryParam("query", query)
                    .queryParam("start", String.valueOf(start))
                    .queryParam("end", String.valueOf(end))
                    .queryParam("step", step)
                    .build().encode().toUri();

            ResponseEntity<String> response = restTemplate.getForEntity(uri, String.class);
            JsonNode root = objectMapper.readTree(response.getBody());
            return root.path("data");
        } catch (Exception e) {
            log.error("PromQL range query failed: {} - Error: {}", query, e.getMessage());
            return null;
        }
    }

    private Double querySingleValue(String query) {
        try {
            java.net.URI uri = UriComponentsBuilder.fromHttpUrl(metricsBaseUrl + "/api/v1/query")
                    .queryParam("query", query)
                    .build().encode().toUri();

            ResponseEntity<String> response = restTemplate.getForEntity(uri, String.class);
            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode result = root.path("data").path("result");
            if (result.isArray() && result.size() > 0) {
                JsonNode valueNode = result.get(0).path("value");
                if (valueNode.isArray() && valueNode.size() > 1) {
                    String valStr = valueNode.get(1).asText();
                    if ("NaN".equals(valStr)) return 0.0;
                    return Double.parseDouble(valStr);
                }
            }
            return null;
        } catch (Exception e) {
            log.warn("PromQL query failed: {} - Error: {}", query, e.getMessage());
            return null;
        }
    }

    private String getStep(String range) {
        switch (range) {
            case "15m": return "3s";
            case "1h": return "12s";
            case "6h": return "72s";
            case "24h": return "288s";
            default: return "12s";
        }
    }

    private String getStart(String range) {
        if (range == null || range.isEmpty()) return "now-1h";
        return "now-" + range;
    }

    private long parseDurationToSeconds(String duration) {
        try {
            if (duration.endsWith("m")) {
                return Long.parseLong(duration.replace("m", "")) * 60;
            } else if (duration.endsWith("h")) {
                return Long.parseLong(duration.replace("h", "")) * 3600;
            } else if (duration.endsWith("d")) {
                return Long.parseLong(duration.replace("d", "")) * 86400;
            } else if (duration.endsWith("s")) {
                return Long.parseLong(duration.replace("s", ""));
            }
        } catch (Exception e) {
            log.warn("Failed to parse duration: {}", duration);
        }
        return 3600; // default 1h
    }

    @Data
    @Builder
    public static class LinkHealthSummary {
        private String linkId;
        private String linkName;
        private String sourceNode;
        private String targetNode;
        private Integer targetPort;
        private String protocol;
        private String status;
        private double currentLatencyMs;
        private double avgLatencyMs;
        private double maxLatencyMs;
        private double uptimePercent;
        private double errorRate;
        private Date lastChecked;
    }
}
