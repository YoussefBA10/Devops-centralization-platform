package com.monetique.eye.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.monetique.eye.entity.Cluster;
import com.monetique.eye.entity.NetworkAlertRule;
import com.monetique.eye.entity.ServiceLink;
import com.monetique.eye.entity.VmRegistry;
import com.monetique.eye.repository.ClusterRepository;
import com.monetique.eye.repository.NetworkAlertRuleRepository;
import com.monetique.eye.repository.ServiceLinkRepository;
import com.monetique.eye.repository.VmRegistryRepository;
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

    private final VmRegistryRepository vmRegistryRepository;
    private final ServiceLinkRepository serviceLinkRepository;
    private final NetworkAlertRuleRepository alertRuleRepository;
    private final ClusterRepository clusterRepository;

    private final ScrapeConfigGeneratorService scrapeGenerator;
    private final PrometheusAlertRulesGeneratorService alertRulesGenerator;
    private final NetworkMetricsProxyService metricsProxy;
    private final NetworkTopologyService topologyService;
    private final ElasticsearchLogQueryService logQueryService;
    private final AlertmanagerProxyService alertmanagerProxy;

    // --- VMs ---

    @GetMapping("/vms")
    public ResponseEntity<List<VmRegistry>> getVms(@RequestParam Long clusterId, @RequestParam String env) {
        return ResponseEntity.ok(vmRegistryRepository.findByClusterIdAndEnv(clusterId, env));
    }

    @PostMapping("/vms")
    public ResponseEntity<VmRegistry> addVm(@RequestBody VmRequest request) {
        Cluster cluster = clusterRepository.findById(request.getClusterId()).orElseThrow(() -> new RuntimeException("Cluster not found"));
        VmRegistry vm = VmRegistry.builder()
                .name(request.getName())
                .ipAddress(request.getIpAddress())
                .role(request.getRole())
                .cluster(cluster)
                .env(request.getEnv())
                .nodeExporterPort(request.getNodeExporterPort() != null ? request.getNodeExporterPort() : 9100)
                .cadvisorPort(request.getCadvisorPort() != null ? request.getCadvisorPort() : 8080)
                .appMetricsPort(request.getAppMetricsPort())
                .appMetricsPath(request.getAppMetricsPath() != null ? request.getAppMetricsPath() : "/metrics")
                .appName(request.getAppName())
                .build();
        
        VmRegistry saved = vmRegistryRepository.save(vm);
        scrapeGenerator.generateAndReload();
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/vms/{id}")
    public ResponseEntity<Void> deleteVm(@PathVariable String id) {
        vmRegistryRepository.deleteById(id);
        scrapeGenerator.generateAndReload();
        return ResponseEntity.ok().build();
    }

    @GetMapping("/vms/{id}/exporter-status")
    public ResponseEntity<Map<String, Object>> getExporterStatus(@PathVariable String id) {
        return ResponseEntity.ok(metricsProxy.checkExporterCollectors(id));
    }

    // --- Links ---

    @GetMapping("/links")
    public ResponseEntity<List<ServiceLink>> getLinks(@RequestParam Long clusterId, @RequestParam String env) {
        return ResponseEntity.ok(serviceLinkRepository.findByClusterIdAndEnv(clusterId, env));
    }

    @PostMapping("/links")
    public ResponseEntity<ServiceLink> addLink(@RequestBody LinkRequest request) {
        VmRegistry source = vmRegistryRepository.findById(request.getSourceVmId()).orElseThrow();
        VmRegistry target = vmRegistryRepository.findById(request.getTargetVmId()).orElseThrow();
        
        ServiceLink link = ServiceLink.builder()
                .name(request.getName() != null ? request.getName() : source.getName() + " -> " + target.getName())
                .sourceVm(source)
                .targetVm(target)
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

    // --- Topology ---

    @GetMapping("/topology")
    public ResponseEntity<NetworkTopologyService.TopologyGraph> getTopology(@RequestParam Long clusterId, @RequestParam String env) {
        return ResponseEntity.ok(topologyService.buildTopologyGraph(clusterId, env));
    }

    // --- Metrics ---

    @GetMapping("/metrics/link/{linkId}")
    public ResponseEntity<Map<String, Object>> getLinkMetrics(@PathVariable String linkId, @RequestParam(defaultValue = "1h") String range) {
        return ResponseEntity.ok(metricsProxy.getLinkMetrics(linkId, range));
    }

    @GetMapping("/metrics/vm/{vmId}")
    public ResponseEntity<Map<String, Object>> getVmNetworkMetrics(@PathVariable String vmId, @RequestParam(defaultValue = "1h") String range) {
        return ResponseEntity.ok(metricsProxy.getVmNetworkMetrics(vmId, range));
    }

    @GetMapping("/metrics/vm/{vmId}/containers")
    public ResponseEntity<Map<String, Map<String, Object>>> getVmContainerNetworkMetrics(@PathVariable String vmId, @RequestParam(defaultValue = "1h") String range) {
        return ResponseEntity.ok(metricsProxy.getVmContainerNetworkMetrics(vmId, range));
    }

    @GetMapping("/metrics/health-summary")
    public ResponseEntity<List<NetworkMetricsProxyService.LinkHealthSummary>> getHealthSummary(@RequestParam Long clusterId, @RequestParam String env) {
        return ResponseEntity.ok(metricsProxy.getHealthSummary(clusterId, env));
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
        if (request.getVmId() != null && !request.getVmId().isEmpty()) {
            rule.setVm(vmRegistryRepository.findById(request.getVmId()).orElse(null));
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
    public static class VmRequest {
        private String name;
        private String ipAddress;
        private String role;
        private Long clusterId;
        private String env;
        private Integer nodeExporterPort;
        private Integer cadvisorPort;
        private Integer appMetricsPort;
        private String appMetricsPath;
        private String appName;
    }

    @Data
    public static class LinkRequest {
        private String name;
        private String sourceVmId;
        private String targetVmId;
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
        private String vmId;
        private Double thresholdValue;
        private String thresholdUnit;
        private String severity;
    }
}
