package com.monetique.eye.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import java.util.*;

@Service
public class PrometheusClient {

    private final WebClient webClient;

    public PrometheusClient(@Value("${prometheus.url}") String prometheusUrl, WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.baseUrl(prometheusUrl).build();
    }

    public Double queryMetric(String query) {
        try {
            Map result = webClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/api/v1/query")
                            .queryParam("query", query)
                            .build())
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (result != null && "success".equals(result.get("status"))) {
                Map data = (Map) result.get("data");
                List results = (List) data.get("result");
                if (!results.isEmpty()) {
                    Map firstResult = (Map) results.get(0);
                    List valuePair = (List) firstResult.get("value");
                    return Double.parseDouble(valuePair.get(1).toString());
                }
            }
        } catch (Exception e) {
            log.error("Prometheus query failed: {}", query, e);
        }
        return 0.0;
    }

    public List<Map<String, Object>> queryList(String query) {
        List<Map<String, Object>> list = new ArrayList<>();
        try {
            Map result = webClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/api/v1/query")
                            .queryParam("query", query)
                            .build())
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (result != null && "success".equals(result.get("status"))) {
                Map data = (Map) result.get("data");
                List<Map> results = (List<Map>) data.get("result");
                for (Map res : results) {
                    Map<String, Object> item = new HashMap<>();
                    item.put("metric", res.get("metric"));
                    List valuePair = (List) res.get("value");
                    item.put("value", valuePair.get(1));
                    list.add(item);
                }
            }
        } catch (Exception e) {
            log.error("Prometheus list query failed: {}", query, e);
        }
        return list;
    }

    public Double getCpuUsage(String envLabel) {
        String query = String.format("avg(1 - rate(node_cpu_seconds_total{mode=\"idle\", environment=\"%s\"}[5m])) * 100", envLabel);
        return queryMetric(query);
    }

    public Double getMemoryUsagePercent(String envLabel) {
        String query = String.format("(1 - (node_memory_MemAvailable_bytes{environment=\"%s\"} / node_memory_MemTotal_bytes{environment=\"%s\"})) * 100", envLabel, envLabel);
        return queryMetric(query);
    }

    public Double getDiskUsagePercent(String envLabel) {
        String query = String.format("max(1 - (node_filesystem_avail_bytes{mountpoint=\"/\", environment=\"%s\"} / node_filesystem_size_bytes{mountpoint=\"/\", environment=\"%s\"})) * 100", envLabel, envLabel);
        return queryMetric(query);
    }

    public Long getActiveNodeCount(String envLabel) {
        String query = String.format("count(up{job=\"node-exporter\", environment=\"%s\"} == 1)", envLabel);
        return Math.round(queryMetric(query));
    }

    public Long getTotalActiveNodes() {
        return Math.round(queryMetric("count(up{job=\"node-exporter\"} == 1)"));
    }

    public Double getAvgStability() {
        // Mock stability or query instance uptime percentage
        return queryMetric("avg(avg_over_time(up{job=\"node-exporter\"}[1h])) * 100");
    }
}

