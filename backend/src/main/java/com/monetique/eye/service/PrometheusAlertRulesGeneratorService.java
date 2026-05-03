package com.monetique.eye.service;

import com.monetique.eye.entity.NetworkAlertRule;
import com.monetique.eye.repository.NetworkAlertRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.yaml.snakeyaml.DumperOptions;
import org.yaml.snakeyaml.Yaml;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class PrometheusAlertRulesGeneratorService {

    private final NetworkAlertRuleRepository ruleRepository;
    private final RestTemplate restTemplate;

    @Value("${monitoring.prometheus.rules-dir:/opt/monitoring/prometheus/rules}")
    private String rulesDir;

    @Value("${monitoring.prometheus.reload-url:http://localhost:9090/-/reload}")
    private String prometheusReloadUrl;

    public void generateAndReload() {
        log.info("Generating Prometheus alert rules for network monitor...");
        try {
            String yamlContent = generateYaml();
            validateYaml(yamlContent);
            writeAtomically(yamlContent);
            reloadPrometheus();
        } catch (Exception e) {
            log.error("Failed to generate or reload Prometheus rules: {}", e.getMessage(), e);
            throw new RuntimeException("Alert rules generation failed: " + e.getMessage(), e);
        }
    }

    private String generateYaml() {
        List<NetworkAlertRule> dbRules = ruleRepository.findByEnabledTrue();

        List<Map<String, Object>> prometheusRules = new ArrayList<>();

        for (NetworkAlertRule rule : dbRules) {
            Map<String, Object> promRule = new LinkedHashMap<>();
            promRule.put("alert", rule.getName().replaceAll("\\s+", ""));
            promRule.put("expr", buildExpression(rule));
            promRule.put("for", buildDuration(rule));
            
            Map<String, String> labels = new HashMap<>();
            labels.put("severity", rule.getSeverity().toLowerCase());
            if (rule.getLink() != null) {
                labels.put("link_id", rule.getLink().getId());
            }
            if (rule.getNode() != null) {
                labels.put("node_id", String.valueOf(rule.getNode().getId()));
            }
            promRule.put("labels", labels);

            Map<String, String> annotations = new HashMap<>();
            annotations.put("summary", rule.getName() + " triggered");
            annotations.put("description", buildDescription(rule));
            promRule.put("annotations", annotations);

            prometheusRules.add(promRule);
        }

        Map<String, Object> group = new LinkedHashMap<>();
        group.put("name", "network_monitor");
        group.put("interval", "30s");
        group.put("rules", prometheusRules);

        Map<String, Object> root = new LinkedHashMap<>();
        root.put("groups", Collections.singletonList(group));

        DumperOptions options = new DumperOptions();
        options.setDefaultFlowStyle(DumperOptions.FlowStyle.BLOCK);
        options.setIndicatorIndent(2);
        options.setIndent(4);
        
        Yaml yaml = new Yaml(options);
        return yaml.dump(root);
    }

    private String buildExpression(NetworkAlertRule rule) {
        String filter = "";
        if (rule.getLink() != null) {
            filter = "{link_id=\"" + rule.getLink().getId() + "\"}";
        } else if (rule.getNode() != null) {
            filter = "{node_id=\"" + rule.getNode().getId() + "\"}";
        } else {
            // Apply to specific jobs to prevent wide matches
            filter = "{job=~\"blackbox_probe.*|node_exporter|cadvisor\"}";
        }

        switch (rule.getRuleType()) {
            case "LINK_DOWN":
                return "probe_success" + filter + " == 0";
            case "HIGH_LATENCY":
            case "CRITICAL_LATENCY":
                // threshold_value is in ms, probe_duration_seconds is in seconds
                return "probe_duration_seconds" + filter + " > " + (rule.getThresholdValue() / 1000.0);
            case "TCP_RETRANSMIT":
                return "rate(node_netstat_Tcp_RetransSegs" + filter + "[5m]) > " + rule.getThresholdValue();
            case "PACKET_DROP":
                return "rate(node_network_receive_drop_total" + filter + "[5m]) > " + rule.getThresholdValue();
            case "BANDWIDTH_SAT":
                // Value is Mbps. We convert to bps -> Mbps = bps / 1e6. So bytes*8 > Mbps * 1e6
                return "rate(node_network_receive_bytes_total" + filter + "[5m]) * 8 > " + (rule.getThresholdValue() * 1000000);
            case "HIGH_ERROR_RATE":
                // Assuming threshold is percentage (e.g. 1 for 1%)
                return "(rate(http_server_requests_seconds_count{status=~\"5..\"}[5m]) / rate(http_server_requests_seconds_count[5m])) > " + (rule.getThresholdValue() / 100.0);
            case "HIGH_P99":
                // Assuming threshold is ms
                return "histogram_quantile(0.99, rate(http_server_requests_seconds_bucket[5m])) > " + (rule.getThresholdValue() / 1000.0);
            default:
                return "up" + filter + " == 0";
        }
    }

    private String buildDuration(NetworkAlertRule rule) {
        switch (rule.getRuleType()) {
            case "LINK_DOWN": return "1m";
            case "HIGH_LATENCY": return "2m";
            case "CRITICAL_LATENCY": return "1m";
            case "TCP_RETRANSMIT": return "3m";
            case "PACKET_DROP": return "2m";
            case "BANDWIDTH_SAT": return "5m";
            case "HIGH_ERROR_RATE": return "2m";
            case "HIGH_P99": return "3m";
            default: return "2m";
        }
    }

    private String buildDescription(NetworkAlertRule rule) {
        return "Rule " + rule.getName() + " breached threshold " + rule.getThresholdValue() + " " + (rule.getThresholdUnit() != null ? rule.getThresholdUnit() : "");
    }

    private void validateYaml(String yamlContent) {
        try {
            Yaml yaml = new Yaml();
            yaml.load(yamlContent);
        } catch (Exception e) {
            throw new RuntimeException("Generated YAML is invalid", e);
        }
    }

    private void writeAtomically(String content) throws IOException {
        File dir = new File(rulesDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }
        
        Path finalPath = Paths.get(rulesDir, "network_alerts.yml");
        Path tmpPath = Paths.get(rulesDir, "network_alerts.yml.tmp");
        
        try (FileWriter writer = new FileWriter(tmpPath.toFile())) {
            writer.write(content);
        }
        
        Files.move(tmpPath, finalPath, StandardCopyOption.REPLACE_EXISTING);
        log.info("Wrote alert rules to {}", finalPath);
    }

    private void reloadPrometheus() {
        try {
            HttpHeaders headers = new HttpHeaders();
            HttpEntity<String> entity = new HttpEntity<>(null, headers);
            ResponseEntity<String> response = restTemplate.exchange(prometheusReloadUrl, HttpMethod.POST, entity, String.class);
            
            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new RuntimeException("Prometheus returned non-2xx: " + response.getStatusCode() + " body: " + response.getBody());
            }
            log.info("Prometheus successfully reloaded.");
        } catch (Exception e) {
            log.error("Error reloading Prometheus: {}", e.getMessage());
            throw new RuntimeException("Prometheus reload failed: " + e.getMessage(), e);
        }
    }
}
