package com.monetique.eye.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.monetique.eye.entity.ManagedNode;
import com.monetique.eye.entity.NetworkAlertRule;
import com.monetique.eye.entity.ServiceLink;
import com.monetique.eye.repository.ClusterRepository;
import com.monetique.eye.repository.ManagedNodeRepository;
import com.monetique.eye.repository.NetworkAlertRuleRepository;
import com.monetique.eye.repository.ServiceLinkRepository;
import com.monetique.eye.service.*;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/network")
@RequiredArgsConstructor
@Slf4j
public class NetworkController {

    private final ManagedNodeRepository managedNodeRepository;
    private final ServiceLinkRepository serviceLinkRepository;
    private final NetworkAlertRuleRepository alertRuleRepository;
    private final ClusterRepository clusterRepository;

    private final ScrapeConfigGeneratorService scrapeGenerator;
    private final PrometheusAlertRulesGeneratorService alertRulesGenerator;
    private final NetworkMetricsProxyService metricsProxy;
    private final NetworkTopologyService topologyService;
    private final ElasticsearchLogQueryService logQueryService;
    private final AlertmanagerProxyService alertmanagerProxy;

    // --- Nodes ---

    @GetMapping("/vms")
    public ResponseEntity<List<ManagedNode>> getNodes(@RequestParam(required = false) Long clusterId, @RequestParam(required = false) Long envId) {
        if (envId != null) {
            return ResponseEntity.ok(managedNodeRepository.findByEnvironment_Cluster_IdAndEnvironment_Id(clusterId, envId));
        } else if (clusterId != null) {
            return ResponseEntity.ok(managedNodeRepository.findByEnvironment_Cluster_Id(clusterId));
        } else {
            return ResponseEntity.ok(managedNodeRepository.findAll());
        }
    }

    @GetMapping("/vms/{id}/exporter-status")
    public ResponseEntity<Map<String, Object>> getExporterStatus(@PathVariable Long id) {
        return ResponseEntity.ok(metricsProxy.checkExporterCollectors(id));
    }

    // --- Links ---

    @GetMapping("/links")
    public ResponseEntity<List<ServiceLink>> getLinks(@RequestParam(required = false) Long clusterId, @RequestParam(required = false) Long envId) {
        if (envId != null) {
            return ResponseEntity.ok(serviceLinkRepository.findByClusterIdAndEnvironmentId(clusterId, envId));
        } else if (clusterId != null) {
            return ResponseEntity.ok(serviceLinkRepository.findByClusterId(clusterId));
        } else {
            return ResponseEntity.ok(serviceLinkRepository.findAll());
        }
    }

    @PostMapping("/links")
    public ResponseEntity<ServiceLink> addLink(@RequestBody LinkRequest request) {
        ManagedNode source = managedNodeRepository.findById(request.getSourceNodeId()).orElseThrow();
        ManagedNode target = managedNodeRepository.findById(request.getTargetNodeId()).orElseThrow();
        
        ServiceLink link = ServiceLink.builder()
                .name(request.getName() != null ? request.getName() : source.getNodeName() + " -> " + target.getNodeName())
                .sourceNode(source)
                .targetNode(target)
                .targetPort(request.getTargetPort())
                .targetPath(request.getTargetPath() != null ? request.getTargetPath() : "/health")
                .protocol(request.getProtocol() != null ? request.getProtocol() : "http")
                .probeModule(request.getProbeModule() != null ? request.getProbeModule() : "http_2xx")
                .enabled(true)
                .build();
        
        ServiceLink saved = serviceLinkRepository.save(link);
        scrapeGenerator.generateAndReload();
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/links/{id}")
    public ResponseEntity<Void> deleteLink(@PathVariable String id) {
        serviceLinkRepository.deleteById(id);
        scrapeGenerator.generateAndReload();
        return ResponseEntity.ok().build();
    }

    @PutMapping("/links/{id}")
    public ResponseEntity<ServiceLink> updateLink(@PathVariable String id, @RequestBody LinkRequest request) {
        ServiceLink link = serviceLinkRepository.findById(id).orElseThrow();
        
        if (request.getName() != null) link.setName(request.getName());
        if (request.getTargetPort() != null) link.setTargetPort(request.getTargetPort());
        if (request.getTargetPath() != null) link.setTargetPath(request.getTargetPath());
        if (request.getProtocol() != null) link.setProtocol(request.getProtocol());
        if (request.getProbeModule() != null) link.setProbeModule(request.getProbeModule());
        if (request.getSourceNodeId() != null) link.setSourceNode(managedNodeRepository.findById(request.getSourceNodeId()).orElseThrow());
        if (request.getTargetNodeId() != null) link.setTargetNode(managedNodeRepository.findById(request.getTargetNodeId()).orElseThrow());

        ServiceLink saved = serviceLinkRepository.save(link);
        scrapeGenerator.generateAndReload();
        return ResponseEntity.ok(saved);
    }

    // --- Topology ---

    @GetMapping("/topology")
    public ResponseEntity<NetworkTopologyService.TopologyGraph> getTopology(@RequestParam(required = false) Long clusterId, @RequestParam(required = false) Long envId) {
        return ResponseEntity.ok(topologyService.buildTopologyGraph(clusterId, envId));
    }

    // --- Metrics ---

    @GetMapping("/metrics/link/{linkId}")
    public ResponseEntity<Map<String, Object>> getLinkMetrics(@PathVariable String linkId, @RequestParam(defaultValue = "1h") String range) {
        return ResponseEntity.ok(metricsProxy.getLinkMetrics(linkId, range));
    }

    @GetMapping("/metrics/vm/{nodeId}")
    public ResponseEntity<Map<String, Object>> getVmNetworkMetrics(@PathVariable Long nodeId, @RequestParam(defaultValue = "1h") String range) {
        return ResponseEntity.ok(metricsProxy.getVmNetworkMetrics(nodeId, range));
    }

    @GetMapping("/metrics/vm/{nodeId}/containers")
    public ResponseEntity<Map<String, Map<String, Object>>> getVmContainerNetworkMetrics(@PathVariable Long nodeId, @RequestParam(defaultValue = "1h") String range) {
        return ResponseEntity.ok(metricsProxy.getVmContainerNetworkMetrics(nodeId, range));
    }

    @GetMapping("/metrics/health-summary")
    public ResponseEntity<List<NetworkMetricsProxyService.LinkHealthSummary>> getHealthSummary(@RequestParam(required = false) Long clusterId, @RequestParam(required = false) Long envId) {
        return ResponseEntity.ok(metricsProxy.getHealthSummary(clusterId, envId));
    }

    // --- Logs ---

    @GetMapping("/logs")
    public ResponseEntity<List<Map<String, Object>>> getLogs(
            @RequestParam String env,
            @RequestParam(required = false) String vmId,
            @RequestParam(required = false) String linkId,
            @RequestParam(required = false, defaultValue = "ERROR") String level,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(logQueryService.queryLogs(env, vmId, linkId, level, from, to, q, page, size));
    }

    // --- Alerts ---

    @GetMapping("/alerts/active")
    public ResponseEntity<JsonNode> getActiveAlerts() {
        return ResponseEntity.ok(alertmanagerProxy.getActiveAlerts());
    }

    @PostMapping("/alerts/{id}/silence")
    public ResponseEntity<Void> silenceAlert(@PathVariable String id) {
        alertmanagerProxy.silenceAlert(id);
        return ResponseEntity.ok().build();
    }

    // --- Alert Rules ---

    @GetMapping("/alert-rules")
    public ResponseEntity<List<NetworkAlertRule>> getAlertRules() {
        return ResponseEntity.ok(alertRuleRepository.findAll());
    }

    @PostMapping("/alert-rules")
    public ResponseEntity<NetworkAlertRule> addAlertRule(@RequestBody RuleRequest request) {
        NetworkAlertRule rule = NetworkAlertRule.builder()
                .name(request.getName())
                .ruleType(request.getRuleType())
                .thresholdValue(request.getThresholdValue())
                .thresholdUnit(request.getThresholdUnit())
                .severity(request.getSeverity() != null ? request.getSeverity() : "WARNING")
                .enabled(true)
                .build();
        
        if (request.getLinkId() != null && !request.getLinkId().isEmpty()) {
            rule.setLink(serviceLinkRepository.findById(request.getLinkId()).orElse(null));
        }
        if (request.getNodeId() != null) {
            rule.setNode(managedNodeRepository.findById(request.getNodeId()).orElse(null));
        }

        NetworkAlertRule saved = alertRuleRepository.save(rule);
        alertRulesGenerator.generateAndReload();
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/alert-rules/{id}")
    public ResponseEntity<Void> deleteAlertRule(@PathVariable String id) {
        alertRuleRepository.deleteById(id);
        alertRulesGenerator.generateAndReload();
        return ResponseEntity.ok().build();
    }

    @PostMapping("/admin/regenerate-scrape-config")
    public ResponseEntity<Void> regenerateScrapeConfig() {
        scrapeGenerator.generateAndReload();
        return ResponseEntity.ok().build();
    }

    // --- DTOs ---

    @Data
    public static class LinkRequest {
        private String name;
        private Long sourceNodeId;
        private Long targetNodeId;
        private Integer targetPort;
        private String targetPath;
        private String protocol;
        private String probeModule;
    }

    @Data
    public static class RuleRequest {
        private String name;
        private String ruleType;
        private String linkId;
        private Long nodeId;
        private Double thresholdValue;
        private String thresholdUnit;
        private String severity;
    }
}
