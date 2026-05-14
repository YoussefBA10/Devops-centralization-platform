package com.monetique.eye.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;
import java.net.URI;
import java.util.*;

@Service
public class PrometheusClient {
    private static final Logger log = LoggerFactory.getLogger(PrometheusClient.class);

    private final WebClient webClient;
    private final String prometheusUrl;

    public PrometheusClient(@Value("${prometheus.url}") String prometheusUrl, WebClient.Builder webClientBuilder) {
        this.prometheusUrl = prometheusUrl;
        
        // Configure explicit timeouts and force system DNS resolver
        io.netty.channel.ChannelOption<Integer> connectTimeout = io.netty.channel.ChannelOption.CONNECT_TIMEOUT_MILLIS;
        
        reactor.netty.http.client.HttpClient httpClient = reactor.netty.http.client.HttpClient.create()
                .resolver(io.netty.resolver.DefaultAddressResolverGroup.INSTANCE) 
                .option(connectTimeout, 10000)
                .responseTimeout(java.time.Duration.ofSeconds(15))
                .doOnConnected(conn -> conn
                        .addHandlerLast(new io.netty.handler.timeout.ReadTimeoutHandler(15))
                        .addHandlerLast(new io.netty.handler.timeout.WriteTimeoutHandler(15)));

        this.webClient = webClientBuilder
                .baseUrl(prometheusUrl)
                .clientConnector(new org.springframework.http.client.reactive.ReactorClientHttpConnector(httpClient))
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(10 * 1024 * 1024))
                .build();
    }

    public Double queryMetric(String query) {
        try {
            Map result = proxyQuery(query);
            if (result != null && "success".equals(result.get("status"))) {
                Map data = (Map) result.get("data");
                List results = (List) data.get("result");
                if (!results.isEmpty()) {
                    Map firstResult = (Map) results.get(0);
                    List valuePair = (List) firstResult.get("value");
                    String val = valuePair.get(1).toString();
                    if (val.equals("+Inf") || val.equals("Inf") || val.equals("-Inf") || val.equals("NaN")) {
                        return 0.0;
                    }
                    return Double.parseDouble(val);
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
            Map result = proxyQuery(query);
            if (result != null && "success".equals(result.get("status"))) {
                Map data = (Map) result.get("data");
                List<Map> results = (List<Map>) data.get("result");
                for (Map res : results) {
                    Map<String, Object> item = new HashMap<>();
                    item.put("metric", res.get("metric"));
                    List valuePair = (List) res.get("value");
                    if (valuePair != null && valuePair.size() >= 2) {
                        item.put("timestamp", valuePair.get(0));
                        item.put("value", valuePair.get(1));
                    }
                    list.add(item);
                }
            }
        } catch (Exception e) {
            log.error("Prometheus list query failed: {}", query, e);
        }
        return list;
    }

    public Map<String, Object> proxyQuery(String query) {
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl(prometheusUrl)
                    .path("/api/v1/query")
                    .queryParam("query", query)
                    .build()
                    .toUri();

            log.debug("Proxying instant query to: {}", uri);
            return webClient.get()
                    .uri(uri)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
        } catch (Exception e) {
            log.error("Prometheus proxy query failed: {}", query, e);
            Map<String, Object> error = new HashMap<>();
            error.put("status", "error");
            error.put("error", e.getMessage());
            return error;
        }
    }

    public Map<String, Object> proxyQueryRange(String query, String start, String end, String step) {
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl(prometheusUrl)
                    .path("/api/v1/query_range")
                    .queryParam("query", query)
                    .queryParam("start", start)
                    .queryParam("end", end)
                    .queryParam("step", step)
                    .build()
                    .toUri();

            log.debug("Proxying range query to: {}", uri);
            return webClient.get()
                    .uri(uri)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
        } catch (Exception e) {
            log.error("Prometheus proxy range query failed: {}", query, e);
            Map<String, Object> error = new HashMap<>();
            error.put("status", "error");
            error.put("error", e.getMessage());
            return error;
        }
    }

    public Map<String, Object> queryRange(String query, String start, String end, String step) {
        Map result = proxyQueryRange(query, start, end, step);
        if (result != null && "success".equals(result.get("status"))) {
            return (Map<String, Object>) result.get("data");
        }
        return new HashMap<>();
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
        String query = String.format(
            "avg(1 - (node_filesystem_avail_bytes{mountpoint=\"/data\", environment=\"%s\"} / " +
            "node_filesystem_size_bytes{mountpoint=\"/data\", environment=\"%s\"})) * 100", 
            envLabel, envLabel
        );
        return queryMetric(query);
    }

    public Long getActiveNodeCount(String envLabel) {
        String query = String.format("count(up{job=\"node-exporter\", environment=\"%s\"} == 1)", envLabel);
        return Math.round(queryMetric(query));
    }

    public Long getTotalActiveNodes() {
        return Math.round(queryMetric("count(up{job=\"node-exporter\"} == 1)"));
    }

    public Double getCpuUsageForInstance(String instance) {
        String query = String.format("avg(1 - rate(node_cpu_seconds_total{mode=\"idle\", instance=\"%s\"}[5m])) * 100", instance);
        return queryMetric(query);
    }

    public Double getMemoryUsagePercentForInstance(String instance) {
        String query = String.format("(1 - (node_memory_MemAvailable_bytes{instance=\"%s\"} / node_memory_MemTotal_bytes{instance=\"%s\"})) * 100", instance, instance);
        return queryMetric(query);
    }

    public Double getAvgStability() {
        return queryMetric("avg(avg_over_time(up{job=\"node-exporter\"}[1h])) * 100");
    }

    public List<Map<String, Object>> getContainerCpuUsage(String envFilter) {
        String query = String.format("sum by (container_label_com_docker_compose_service, name, instance) (%s)", 
                buildContainerQuery("rate(container_cpu_usage_seconds_total", "[5m])", envFilter));
        return queryList(query);
    }

    public List<Map<String, Object>> getContainerMemoryUsage(String envFilter) {
        String query = String.format("max by (container_label_com_docker_compose_service, name, instance) (%s)", 
                buildContainerQuery("container_memory_usage_bytes", "", envFilter));
        return queryList(query);
    }

    public List<Map<String, Object>> getContainerNetworkRx(String envFilter) {
        String query = String.format("sum by (container_label_com_docker_compose_service, name, instance) (%s)", 
                buildContainerQuery("rate(container_network_receive_bytes_total", "[5m])", envFilter));
        return queryList(query);
    }

    public List<Map<String, Object>> getContainerNetworkTx(String envFilter) {
        String query = String.format("sum by (container_label_com_docker_compose_service, name, instance) (%s)", 
                buildContainerQuery("rate(container_network_transmit_bytes_total", "[5m])", envFilter));
        return queryList(query);
    }

    public List<Map<String, Object>> getContainerDiskRead(String envFilter) {
        String query = String.format("sum by (container_label_com_docker_compose_service, name, instance) (%s)", 
                buildContainerQuery("rate(container_fs_reads_bytes_total", "[5m])", envFilter));
        return queryList(query);
    }

    public List<Map<String, Object>> getContainerDiskWrite(String envFilter) {
        String query = String.format("sum by (container_label_com_docker_compose_service, name, instance) (%s)", 
                buildContainerQuery("rate(container_fs_writes_bytes_total", "[5m])", envFilter));
        return queryList(query);
    }

    public List<Map<String, Object>> getContainerStartTimes(String envFilter) {
        String infraExclusion = "image!=\"\", name!=\"\", container_label_com_docker_compose_service!~\"prometheus|grafana\", name!~\"prometheus|grafana\"";
        String query = String.format("last_over_time(container_start_time_seconds{%s, environment=~\"%s\"}[10m]) or last_over_time(container_start_time_seconds{%s, container_label_env=~\"%s\"}[10m])",
                infraExclusion, envFilter, infraExclusion, envFilter);
        return queryList(query);
    }

    public List<Map<String, Object>> getContainerRestartCounts(String envFilter) {
        String infraExclusion = "image!=\"\", name!=\"\", container_label_com_docker_compose_service!~\"prometheus|grafana\", name!~\"prometheus|grafana\"";
        String query = String.format("changes(container_start_time_seconds{%s, environment=~\"%s\"}[24h]) or changes(container_start_time_seconds{%s, container_label_env=~\"%s\"}[24h])",
                infraExclusion, envFilter, infraExclusion, envFilter);
        return queryList(query);
    }

    public List<Map<String, Object>> getContainerLastSeen(String envFilter) {
        String infraExclusion = "image!=\"\", name!=\"\", container_label_com_docker_compose_service!~\"prometheus|grafana\", name!~\"prometheus|grafana\"";
        String query = String.format("last_over_time(container_last_seen{%s, environment=~\"%s\"}[10m]) or last_over_time(container_last_seen{%s, container_label_env=~\"%s\"}[10m])",
                infraExclusion, envFilter, infraExclusion, envFilter);
        return queryList(query);
    }

    private String buildContainerQuery(String baseMetric, String suffix, String envFilter) {
        String infraExclusion = "image!=\"\", name!=\"\", container_label_com_docker_compose_service!~\"prometheus|grafana\", name!~\"prometheus|grafana\"";
        return String.format("%1$s{%2$s, environment=~\"%3$s\"}%4$s or %1$s{%2$s, container_label_env=~\"%3$s\"}%4$s", 
                baseMetric, infraExclusion, envFilter, suffix);
    }

    public List<Map<String, Object>> getHostTotalCpu(String envFilter) {
        String query = String.format("count by (instance) (node_cpu_seconds_total{mode=\"idle\", environment=~\"%s\"})", envFilter);
        return queryList(query);
    }

    public List<Map<String, Object>> getHostTotalMemory(String envFilter) {
        String query = String.format("node_memory_MemTotal_bytes{environment=~\"%s\"}", envFilter);
        return queryList(query);
    }

    public List<Map<String, Object>> getActiveAlerts() {
        try {
            Map result = webClient.get()
                    .uri("/api/v1/alerts")
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (result != null && "success".equals(result.get("status"))) {
                Map data = (Map) result.get("data");
                return (List<Map<String, Object>>) data.get("alerts");
            }
        } catch (Exception e) {
            log.error("Failed to fetch alerts from Prometheus", e);
        }
        return new ArrayList<>();
    }
}
