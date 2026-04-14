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
            // Log error
        }
        return 0.0;
    }

    public Double getCpuUsage(String envLabel) {
        String query = String.format("sum(rate(container_cpu_usage_seconds_total{env=\"%s\"}[5m]))", envLabel);
        return queryMetric(query);
    }

    public Double getMemoryUsage(String envLabel) {
        String query = String.format("sum(container_memory_usage_bytes{env=\"%s\"})", envLabel);
        return queryMetric(query);
    }
}
