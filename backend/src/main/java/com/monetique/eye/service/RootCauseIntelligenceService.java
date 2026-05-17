package com.monetique.eye.service;

import com.monetique.eye.client.ElasticsearchLogClient;
import com.monetique.eye.dto.LogAnalyticsResponseDTO.RootCauseRule;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class RootCauseIntelligenceService {
    private final ElasticsearchLogClient esClient;
    private final PrometheusClient prometheusClient;

    /**
     * Correlates signals to detect root cause categories.
     * Logic: resource_saturation > bug/crash > upstream_failure > traffic_spike > config
     */
    public List<RootCauseRule> analyze(String envLabel, String appFilter, String nodeFilter, java.time.Instant start, java.time.Instant end) {
        List<RootCauseRule> insights = new ArrayList<>();
        
        // 1. Fetch SRE signals from Elasticsearch using aggregated fields
        Map<String, Object> signals = esClient.fetchSreSignals(envLabel, appFilter, start, end);
        
        // 2. Score and Rank Causes
        Map<String, Double> scores = new HashMap<>();
        Map<String, List<String>> evidenceMap = new HashMap<>();

        processDbFailure(signals, scores, evidenceMap);
        processMemoryPressure(signals, scores, evidenceMap, envLabel, appFilter, nodeFilter);
        processDiskPressure(signals, scores, evidenceMap, envLabel, appFilter);
        processNetworkFailure(signals, scores, evidenceMap);
        processServiceUnreachable(signals, scores, evidenceMap);
        processBugCrash(signals, scores, evidenceMap);
        processTrafficSpike(signals, scores, evidenceMap);

        // 3. Final Ranking & Confidence Check
        List<RootCauseRule> ranked = scores.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue(), a.getValue()))
                .map(entry -> {
                    String category = entry.getKey();
                    double score = entry.getValue();
                    String confidence = score > 6.0 ? "high" : (score > 4.0 ? "medium" : "low");
                    
                    return RootCauseRule.builder()
                            .id(UUID.randomUUID().toString())
                            .type(getRuleType(category))
                            .title(category.replace("_", " ").toUpperCase())
                            .description(generateDescription(category, evidenceMap.get(category)))
                            .confidence(confidence)
                            .evidence(evidenceMap.get(category))
                            .sources(List.of("Elasticsearch", "Logstash-SRE", "Prometheus", "cAdvisor"))
                            .build();
                })
                .limit(3)
                .collect(Collectors.toList());

        // 4. Fallback if errors exist but no cause identified
        if (ranked.isEmpty()) {
            ranked.add(RootCauseRule.builder()
                    .id(UUID.randomUUID().toString())
                    .type("trigger")
                    .title("GENERAL APPLICATION ERRORS")
                    .description("High error frequency detected but no specific resource saturation or bug patterns identified.")
                    .confidence("low")
                    .evidence(List.of("Aggregated status_code >= 500 detected", "Check individual log stream for stack traces"))
                    .sources(List.of("Elasticsearch"))
                    .build());
        }
        
        return ranked;
    }

    private void processDbFailure(Map<String, Object> signals, Map<String, Double> scores, Map<String, List<String>> evidence) {
        double score = 0;
        List<String> logs = new ArrayList<>();
        
        // Signal: Pool Saturation
        if (checkField(signals, "pool_active_max_match")) {
            score += 2.0;
            logs.add("pool.active=pool.max appeared multiple times");
        }
        // Signal: Wait Time
        if (checkField(signals, "db_wait_high")) {
            score += 1.5;
            logs.add("waited >5000ms on connection detected");
        }
        
        if (score > 0) {
            scores.put("DB_FAILURE", score + 10.0); // RESOURCE_SATURATION (Top Priority)
            evidence.put("DB_FAILURE", logs);
        }
    }

    private void processMemoryPressure(Map<String, Object> signals, Map<String, Double> scores, Map<String, List<String>> evidence, String envLabel, String appFilter, String nodeFilter) {
        double score = 0;
        List<String> logs = new ArrayList<>();
        
        // Log-based signals
        if (checkField(signals, "heap_90_plus")) {
            score += 3.0;
            logs.add("heap usage >90% detected across nodes");
        }
        if (checkField(signals, "oom_error_count")) {
            score += 5.0;
            logs.add("OutOfMemoryError detected in log stream");
        }

        // Metric-based signals (Prometheus/cAdvisor)
        try {
            List<Map<String, Object>> oomEvents = prometheusClient.getOomEvents(envLabel, appFilter, nodeFilter);
            if (!oomEvents.isEmpty()) {
                score += 8.0; // Very high confidence if metric says so
                logs.add("Container OOM Kill event detected by cAdvisor/cgroups");
            }
        } catch (Exception e) {
            log.warn("Failed to fetch Prometheus OOM signals: {}", e.getMessage());
        }

        if (score > 0) {
            scores.put("MEMORY_OOM", score + 9.0); // RESOURCE_SATURATION
            evidence.put("MEMORY_OOM", logs);
        }
    }

    private void processDiskPressure(Map<String, Object> signals, Map<String, Double> scores, Map<String, List<String>> evidence, String envLabel, String appFilter) {
        double score = 0;
        List<String> logs = new ArrayList<>();
        
        if (checkField(signals, "disk_full")) {
            score += 6.0;
            logs.add("\"No space left on device\" detected in logs");
        }
        if (checkField(signals, "disk_usage_high")) {
            score += 3.0;
            logs.add("disk usage >= 85% detected in logs");
        }
        if (checkField(signals, "inode_exhausted")) {
            score += 4.0;
            logs.add("\"No inodes available\" detected in logs");
        }

        try {
            boolean diskPressure = prometheusClient.getDiskPressureEvents(appFilter, envLabel);
            if (diskPressure) {
                score += 5.0;
                logs.add("Container disk usage exceeded 85% limit in Prometheus");
            }
        } catch (Exception e) {
            log.warn("Failed to fetch Prometheus disk pressure signals: {}", e.getMessage());
        }

        if (score > 0) {
            scores.put("DISK_PRESSURE", score + 9.0); // RESOURCE_SATURATION (Priority 2, same as MEMORY_OOM)
            evidence.put("DISK_PRESSURE", logs);
        }
    }

    private void processBugCrash(Map<String, Object> signals, Map<String, Double> scores, Map<String, List<String>> evidence) {
        double score = 0;
        List<String> logs = new ArrayList<>();
        
        if (checkField(signals, "npe_count")) {
            score += 4.0;
            logs.add("NullPointerException detected at specific endpoints");
        }
        
        if (score > 0) {
            scores.put("BUG_CRASH", score + 7.0); // Higher than impact/traffic
            evidence.put("BUG_CRASH", logs);
        }
    }

    private void processNetworkFailure(Map<String, Object> signals, Map<String, Double> scores, Map<String, List<String>> evidence) {
        double score = 0;
        List<String> logs = new ArrayList<>();
        
        if (checkField(signals, "cb_open")) {
            score += 2.5;
            logs.add("circuit-breaker:open detected in upstream calls");
        }
        
        if (score > 0) {
            scores.put("NETWORK_FAILURE", score + 4.0); // Impact/Upstream
            evidence.put("NETWORK_FAILURE", logs);
        }
    }

    private void processServiceUnreachable(Map<String, Object> signals, Map<String, Double> scores, Map<String, List<String>> evidence) {
        double score = 0;
        List<String> logs = new ArrayList<>();
        
        if (checkField(signals, "gateway_error_502")) {
            score += 2.0;
            logs.add("HTTP 502 (Bad Gateway) reported by ingress/gateway");
        }
        if (checkField(signals, "service_unavailable_503")) {
            score += 2.0;
            logs.add("HTTP 503 (Service Unavailable) detected");
        }
        if (checkField(signals, "conn_refused")) {
            score += 3.0;
            logs.add("'Connection refused' detected in peer logs");
        }
        
        if (score > 0) {
            scores.put("SERVICE_UNREACHABLE", score + 5.0); // Impact of a restart/oom
            evidence.put("SERVICE_UNREACHABLE", logs);
        }
    }

    private void processTrafficSpike(Map<String, Object> signals, Map<String, Double> scores, Map<String, List<String>> evidence) {
        double score = 0;
        List<String> logs = new ArrayList<>();
        
        if (checkField(signals, "rate_limit_429")) {
            score += 1.5;
            logs.add("HTTP 429 (Too Many Requests) returned by gateway");
        }
        
        if (score > 0) {
            scores.put("TRAFFIC_SPIKE", score + 1.0);
            evidence.put("TRAFFIC_SPIKE", logs);
        }
    }

    private boolean checkField(Map<String, Object> signals, String key) {
        return signals.get(key) != null;
    }

    private String getRuleType(String category) {
        if (category.equals("DB_FAILURE") || category.equals("MEMORY_OOM") || category.equals("DISK_PRESSURE") || category.equals("SERVICE_UNREACHABLE")) return "root_cause";
        if (category.equals("BUG_CRASH")) return "trigger";
        return "impact";
    }

    private String generateDescription(String category, List<String> evidence) {
        if (evidence == null || evidence.isEmpty()) return "Probable root cause identified based on signal patterns.";
        return "Evidence: " + String.join(", ", evidence);
    }
}
