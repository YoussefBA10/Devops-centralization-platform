package com.monetique.eye.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import java.util.Map;
import java.util.List;

@Service
public class ElasticsearchLogService {

    private final WebClient webClient;

    public ElasticsearchLogService(@Value("${elasticsearch.url}") String esUrl, WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.baseUrl(esUrl).build();
    }

    public long getErrorCount(String environment, int lastMinutes) {
        String index = "app-logs-" + environment + "-*";
        String query = """
                {
                  "query": {
                    "bool": {
                      "must": [
                        { "match": { "severity": "ERROR" } },
                        { "range": { "@timestamp": { "gte": "now-%dm" } } }
                      ]
                    }
                  }
                }
                """.formatted(lastMinutes);

        try {
            Map result = webClient.post()
                    .uri("/" + index + "/_count")
                    .header("Content-Type", "application/json")
                    .bodyValue(query)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            return result != null ? Long.parseLong(result.get("count").toString()) : 0L;
        } catch (Exception e) {
            // Log ES connection error
            return 0L;
        }
    }

    public List<Map<String, Object>> getRecentLogs(String environment, int limit) {
        String index = "app-logs-" + environment + "-*";
        String query = """
                {
                  "size": %d,
                  "sort": [ { "@timestamp": "desc" } ],
                  "query": { "match_all": {} }
                }
                """.formatted(limit);

        try {
            Map result = webClient.post()
                    .uri("/" + index + "/_search")
                    .header("Content-Type", "application/json")
                    .bodyValue(query)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (result != null) {
                Map hits = (Map) result.get("hits");
                List<Map> hitsList = (List<Map>) hits.get("hits");
                return hitsList.stream()
                        .map(h -> (Map<String, Object>) h.get("_source"))
                        .toList();
            }
        } catch (Exception e) {
            // Log error
        }
        return List.of();
    }
}
