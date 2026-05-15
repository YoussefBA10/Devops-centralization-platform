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

    /**
     * Correlates signals to detect root cause categories.
     * Logic: resource_saturation > bug/crash > upstream_failure > traffic_spike > config
     */
    public List<RootCauseRule> analyze(String envLabel, String appFilter, java.time.Instant start, java.time.Instant end) {
        List<RootCauseRule> insights = new ArrayList<>();
        
        // 1. Fetch SRE signals from Elasticsearch using aggregated fields
        Map<String, Object> signals = esClient.fetchSreSignals(envLabel, appFilter, start, end);
        
        // 2. Score and Rank Causes
        Map<String, Double> scores = new HashMap<>();
        Map<String, List<String>> evidenceMap = new HashMap<>();

        processDbFailure(signals, scores, evidenceMap);
        processMemoryPressure(signals, scores, evidenceMap);
        processNetworkFailure(signals, scores, evidenceMap);
        processBugCrash(signals, scores, evidenceMap);
        processTrafficSpike(signals, scores, evidenceMap);

        // 3. Final Ranking & Confidence Check
        return scores.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue(), a.getValue()))
                .map(entry -> {
                    String category = entry.getKey();
                    double score = entry.getValue();
                    String confidence = score > 6.0 ? "high" : (score > 4.0 ? "medium" : "low");
                    
                    return RootCauseRule.builder()
                            .id(UUID.randomUUID().toString())
                            .type(getRuleType(category))
                            .title(category.replace("_", " ").toUpperCase() + " (" + confidence + ")")
                            .description(generateDescription(category, evidenceMap.get(category)))
                            .sources(List.of("Elasticsearch", "Logstash-SRE"))
                            .build();
                })
                .limit(3)
                .collect(Collectors.toList());
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
            scores.put("DB_FAILURE", score + 5.0); // Highest priority category
            evidence.put("DB_FAILURE", logs);
        }
    }

    private void processMemoryPressure(Map<String, Object> signals, Map<String, Double> scores, Map<String, List<String>> evidence) {
        double score = 0;
        List<String> logs = new ArrayList<>();
        
        if (checkField(signals, "heap_90_plus")) {
            score += 2.5;
            logs.add("heap usage >90% detected across nodes");
        }
        if (checkField(signals, "oom_error_count")) {
            score += 3.0;
            logs.add("OutOfMemoryError detected in log stream");
        }

        if (score > 0) {
            scores.put("MEMORY_OOM", score + 4.0);
            evidence.put("MEMORY_OOM", logs);
        }
    }

    private void processBugCrash(Map<String, Object> signals, Map<String, Double> scores, Map<String, List<String>> evidence) {
        double score = 0;
        List<String> logs = new ArrayList<>();
        
        if (checkField(signals, "npe_count")) {
            score += 2.0;
            logs.add("NullPointerException detected at specific endpoints");
        }
        
        if (score > 0) {
            scores.put("BUG_CRASH", score + 3.0);
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
            scores.put("NETWORK_FAILURE", score + 2.0);
            evidence.put("NETWORK_FAILURE", logs);
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
        if (category.equals("DB_FAILURE") || category.equals("MEMORY_OOM")) return "root_cause";
        if (category.equals("BUG_CRASH")) return "trigger";
        return "impact";
    }

    private String generateDescription(String category, List<String> evidence) {
        if (evidence == null || evidence.isEmpty()) return "Probable root cause identified based on signal patterns.";
        return "Evidence: " + String.join(", ", evidence);
    }
}
