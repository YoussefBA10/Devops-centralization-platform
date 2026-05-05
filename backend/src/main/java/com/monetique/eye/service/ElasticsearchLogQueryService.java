package com.monetique.eye.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ElasticsearchLogQueryService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${monitoring.elasticsearch.base-url:http://localhost:9200}")
    private String elasticsearchBaseUrl;

    public List<Map<String, Object>> queryLogs(String env, String vmId, String linkId, String level, String from, String to, String q, int page, int size) {
        // Aligned with Logstash output index pattern: app-logs-<env>-<date>
        // Using lowercase for env to match Logstash normalization
        String normalizedEnv = (env != null) ? env.toLowerCase() : "unknown";
        String indexPattern = "app-logs-" + normalizedEnv + "-*";
        String url = elasticsearchBaseUrl + "/" + indexPattern + "/_search";

        // Build ES query
        Map<String, Object> query = new HashMap<>();
        Map<String, Object> bool = new HashMap<>();
        List<Map<String, Object>> must = new ArrayList<>();

        if (vmId != null && !vmId.isEmpty()) {
            // Map vmId to 'node' field which is used in Logstash normalization
            must.add(Map.of("match", Map.of("node", vmId)));
        }
        
        if (linkId != null && !linkId.isEmpty()) {
            must.add(Map.of("match", Map.of("link_id", linkId)));
        }

        if (level != null && !level.isEmpty()) {
            // Search both 'level' and 'severity' for compatibility
            Map<String, Object> levelQuery = new HashMap<>();
            List<Map<String, Object>> levelShould = new ArrayList<>();
            levelShould.add(Map.of("match", Map.of("level", level)));
            levelShould.add(Map.of("match", Map.of("severity", level)));
            levelQuery.put("bool", Map.of("should", levelShould, "minimum_should_match", 1));
            must.add(levelQuery);
        }

        if (q != null && !q.isEmpty()) {
            must.add(Map.of("query_string", Map.of("query", q)));
        }

        // Add range if from/to provided
        if ((from != null && !from.isEmpty()) || (to != null && !to.isEmpty())) {
            Map<String, Object> rangeFilter = new HashMap<>();
            Map<String, String> rangeOpts = new HashMap<>();
            if (from != null && !from.isEmpty()) rangeOpts.put("gte", from);
            if (to != null && !to.isEmpty()) rangeOpts.put("lte", to);
            rangeFilter.put("@timestamp", rangeOpts);
            must.add(Map.of("range", rangeFilter));
        }

        bool.put("must", must);
        query.put("bool", bool);

        Map<String, Object> searchRequest = new HashMap<>();
        searchRequest.put("query", query);
        searchRequest.put("from", page * size);
        searchRequest.put("size", size);
        searchRequest.put("sort", List.of(Map.of("@timestamp", Map.of("order", "desc"))));

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(searchRequest), headers);

            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            JsonNode root = objectMapper.readTree(response.getBody());
            
            List<Map<String, Object>> results = new ArrayList<>();
            JsonNode hitsNode = root.path("hits").path("hits");
            if (hitsNode.isArray()) {
                for (JsonNode hit : hitsNode) {
                    JsonNode source = hit.path("_source");
                    Map<String, Object> logEntry = new HashMap<>();
                    logEntry.put("timestamp", source.path("@timestamp").asText());
                    
                    // Priority for 'level' then 'severity'
                    String detectedLevel = source.has("level") ? source.path("level").asText() : source.path("severity").asText("INFO");
                    logEntry.put("level", detectedLevel);
                    
                    // Priority for 'message' then 'raw_message'
                    String detectedMsg = source.has("message") ? source.path("message").asText() : source.path("raw_message").asText();
                    logEntry.put("message", detectedMsg);
                    
                    // Map back 'node' to 'vm_id' for frontend consistency
                    logEntry.put("vm_id", source.has("node") ? source.path("node").asText() : source.path("vm_id").asText());
                    results.add(logEntry);
                }
            }
            return results;
        } catch (Exception e) {
            log.error("Failed to query Elasticsearch logs: {}", e.getMessage(), e);
            return new ArrayList<>(); // Return empty list on failure to avoid breaking UI
        }
    }
}
