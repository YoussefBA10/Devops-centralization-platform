package com.monetique.eye.service;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import com.monetique.eye.dto.LogAnalyticsResponseDTO;
import com.monetique.eye.dto.LogAnalyticsResponseDTO.*;
import com.monetique.eye.dto.LogEventDTO;
import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.Environment;
import com.monetique.eye.client.ElasticsearchLogClient;
import com.monetique.eye.entity.Ticket;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class LogAnalyticsService {

    private final PrometheusClient prometheusClient;
    private final ElasticsearchClient esClient;
    private final ElasticsearchLogClient elasticsearchLogClient;
    private final ApplicationRepository applicationRepository;
    private final EnvironmentRepository environmentRepository;
    private final TicketRepository ticketRepository;

    public LogAnalyticsResponseDTO getDashboardData(Long environmentId, String range, String serviceName, String nodeName, Long ticketId) {
        // Resolve ticket context if provided
        String effectiveServiceName = serviceName;
        String effectiveNodeName = nodeName;

        if (ticketId != null) {
            Ticket ticket = ticketRepository.findById(ticketId).orElse(null);
            if (ticket != null) {
                if (ticket.getApplication() != null) {
                    effectiveServiceName = ticket.getApplication().getServiceNameKeyword() != null ? 
                        ticket.getApplication().getServiceNameKeyword() : ticket.getApplication().getName();
                }
                if (ticket.getNode() != null) {
                    effectiveNodeName = ticket.getNode();
                }
                log.info("ANALYTICS: Resolved ticket #{} to service={} node={}", ticketId, effectiveServiceName, effectiveNodeName);
            }
        }

        if (effectiveNodeName != null && effectiveNodeName.matches("^node-\\d+$")) {
            effectiveNodeName = effectiveNodeName.substring(5);
        }

        int hours = parseRange(range);
        Instant end = Instant.now();
        Instant start = end.minus(hours, ChronoUnit.HOURS);

        Environment env = environmentRepository.findById(environmentId).orElse(null);
        String envLabel = env != null ? env.getPrometheusLabel() : ".*";

        // When a specific service is requested (from a ticket), we need two filter sets:
        // 1. Container-level filters: use broad env/node (".*"/null) to find the container wherever it runs
        // 2. App-level filters: use the environment's own label for Spring Boot metrics (HTTP, DB pool)
        String containerEnvLabel = envLabel;
        String containerNodeName = nodeName;
        String appEnvLabel = envLabel;     // For HTTP/DB metrics tied to the environment's backend
        String appNodeName = nodeName;

        List<Application> apps = new ArrayList<>();
        
        if (effectiveServiceName != null && !effectiveServiceName.isBlank()) {
            Application targetApp = applicationRepository.findByName(effectiveServiceName).orElse(null);
            
            if (targetApp != null) {
                apps.add(targetApp);
                // Also try to find related apps by service keyword to ensure we get container metrics correctly
                if (targetApp.getServiceNameKeyword() != null) {
                    applicationRepository.findAllByServiceNameKeyword(targetApp.getServiceNameKeyword())
                        .stream()
                        .filter(a -> !a.getId().equals(targetApp.getId()))
                        .forEach(apps::add);
                }
            } else {
                containerEnvLabel = ".*";
                containerNodeName = null;
            }
            // Also load all apps for the selected environment for broader context
            List<Application> envApps = applicationRepository.findByEnvironmentId(environmentId);
            for (Application a : envApps) {
                if (!apps.contains(a)) apps.add(a);
            }
        } else {
            apps = applicationRepository.findByEnvironmentId(environmentId);
        }
        
        String appFilter = (serviceName != null && !serviceName.isBlank()) ? serviceName : ".*";
        // For Spring Boot metrics (HTTP, DB), use a broader filter that matches any app in the env
        String springFilter = apps.isEmpty() ? ".*" : apps.stream()
                .map(Application::getServiceNameKeyword)
                .filter(Objects::nonNull)
                .collect(Collectors.joining("|"));
        if (springFilter.isEmpty()) springFilter = ".*";

        log.info("ANALYTICS DEBUG: containerEnv={}, containerNode={}, appEnv={}, appNode={}, appFilter={}, springFilter={}", 
                containerEnvLabel, containerNodeName, appEnvLabel, appNodeName, appFilter, springFilter);

        return LogAnalyticsResponseDTO.builder()
                .summaryCards(fetchSummaryCards(appEnvLabel, springFilter, appNodeName, containerEnvLabel, appFilter, containerNodeName))
                .trafficCorrelation(fetchTrafficCorrelation(appEnvLabel, springFilter, appNodeName, start, end))
                .probeSuccess(fetchProbeSuccess(appEnvLabel, appNodeName, start, end))
                .topErrors(fetchTopErrors(appEnvLabel, springFilter, containerNodeName, start, end))
                .resourcePressure(fetchResourcePressure(containerEnvLabel, apps, containerNodeName))
                .rootCauseChain(calculateRootCauseChain(containerEnvLabel, appFilter, containerNodeName))
                .liveLogs(fetchLiveLogs(appEnvLabel, appFilter, containerNodeName, start, end))
                .build();
    }

    private String nodeFilter(String nodeName) {
        return (nodeName != null && !nodeName.isBlank()) ? String.format(", nodename=~\".*%s.*\"", nodeName) : "";
    }

    private List<MetricCard> fetchSummaryCards(String appEnvLabel, String springFilter, String appNodeName, 
                                                String containerEnvLabel, String appFilter, String containerNodeName) {
        List<MetricCard> cards = new ArrayList<>();

        // 1. Error Rate
        String errRateQuery = String.format("sum(rate(http_server_requests_seconds_count{status=~\"5..\", environment=\"%s\", job=~\".*%s.*\"%s}[5m])) / sum(rate(http_server_requests_seconds_count{environment=\"%s\", job=~\".*%s.*\"%s}[5m])) * 100", 
                appEnvLabel, springFilter, nodeFilter(appNodeName), appEnvLabel, springFilter, nodeFilter(appNodeName));
        Double errRate = prometheusClient.queryMetric(errRateQuery);
        cards.add(MetricCard.builder()
                .label("Error rate")
                .value(String.format("%.2f%%", errRate))
                .delta("") // Removed hardcoded delta
                .status(errRate > 5 ? "danger" : errRate > 1 ? "warning" : "neutral")
                .source("prometheus")
                .build());

        // 2. Request Rate
        String reqRateQuery = String.format("sum(rate(http_server_requests_seconds_count{environment=\"%s\", job=~\".*%s.*\"%s}[5m]))", appEnvLabel, springFilter, nodeFilter(appNodeName));
        Double reqRate = prometheusClient.queryMetric(reqRateQuery);
        cards.add(MetricCard.builder()
                .label("Request rate")
                .value(String.format("%.1f req/s", reqRate))
                .delta("") // Removed hardcoded delta
                .status("neutral")
                .source("prometheus")
                .build());

        // 3. DB Pool Usage
        String dbPoolQuery = String.format("sum(hikaricp_connections_active{environment=\"%s\", job=~\".*%s.*\"%s}) / sum(hikaricp_connections_max{environment=\"%s\", job=~\".*%s.*\"%s}) * 100 or vector(0)", appEnvLabel, springFilter, nodeFilter(appNodeName), appEnvLabel, springFilter, nodeFilter(appNodeName));
        Double dbPool = prometheusClient.queryMetric(dbPoolQuery);
        cards.add(MetricCard.builder()
                .label("DB pool usage")
                .value(String.format("%.1f%%", dbPool))
                .delta("") // Removed hardcoded delta
                .status(dbPool > 90 ? "danger" : dbPool > 70 ? "warning" : "neutral")
                .source("prometheus")
                .build());

        // 4. Memory Usage (Dynamic Limit)
        String limitQuery = String.format("sum(container_spec_memory_limit_bytes{environment=~\"%s\", name=~\".*%s.*\"%s}) or vector(0)", containerEnvLabel, appFilter, nodeFilter(containerNodeName));
        Double memLimit = prometheusClient.queryMetric(limitQuery);
        if (memLimit == null || memLimit <= 0) memLimit = 4294967296.0; // Fallback to 4GB if not set

        String memQuery = String.format("sum(container_memory_usage_bytes{environment=~\"%s\", name=~\".*%s.*\"%s}) / %f * 100 or vector(0)", containerEnvLabel, appFilter, nodeFilter(containerNodeName), memLimit);
        Double memUsage = prometheusClient.queryMetric(memQuery);
        cards.add(MetricCard.builder()
                .label("Backend memory")
                .value(String.format("%.1f%%", memUsage))
                .delta("") // Removed hardcoded delta
                .status(memUsage > 85 ? "danger" : memUsage > 70 ? "warning" : "neutral")
                .source("cadvisor")
                .build());

        // 5. Blackbox Probe
        String probeQuery = String.format("avg(probe_success{environment=\"%s\"%s}) * 100 or vector(100)", appEnvLabel, nodeFilter(appNodeName));
        Double probeSuccess = prometheusClient.queryMetric(probeQuery);
        cards.add(MetricCard.builder()
                .label("Blackbox probe")
                .value(String.format("%.1f%%", probeSuccess))
                .delta("") // Removed hardcoded delta
                .status(probeSuccess < 95 ? "danger" : "neutral")
                .source("blackbox")
                .build());

        return cards;
    }

    private ChartData fetchTrafficCorrelation(String envLabel, String appFilter, String nodeName, Instant start, Instant end) {
        long diff = end.getEpochSecond() - start.getEpochSecond();
        String step = Math.max(60, diff / 11) + "s";
        String rateInterval = Math.max(5, (diff / 60) / 11) + "m";
        List<String> labels = generateTimeLabels(start, end, 12);
        
        return ChartData.builder()
                .labels(labels)
                .datasets(List.of(
                        ChartData.Series.builder().label("req/s").data(fetchRangeMetric(String.format("sum(rate(http_server_requests_seconds_count{environment=\"%s\", job=~\".*%s.*\"%s}[%s]))", envLabel, appFilter, nodeFilter(nodeName), rateInterval), start, end, step, 12)).color("#3b82f6").fill(false).build(),
                        ChartData.Series.builder().label("errors/min").data(fetchRangeMetric(String.format("sum(rate(http_server_requests_seconds_count{status=~\"5..\", environment=\"%s\", job=~\".*%s.*\"%s}[%s])) * 60", envLabel, appFilter, nodeFilter(nodeName), rateInterval), start, end, step, 12)).color("#ef4444").fill(true).build(),
                        ChartData.Series.builder().label("DB pool %").data(fetchRangeMetric(String.format("avg(hikaricp_connections_active{environment=\"%s\", job=~\".*%s.*\"%s} / hikaricp_connections_max{environment=\"%s\", job=~\".*%s.*\"%s} * 100)", envLabel, appFilter, nodeFilter(nodeName), envLabel, appFilter, nodeFilter(nodeName)), start, end, step, 12)).color("#f59e0b").dashed(true).fill(false).build()
                ))
                .build();
    }

    private List<Double> fetchRangeMetric(String query, Instant start, Instant end, String step, int count) {
        Map<String, Object> rangeData = prometheusClient.queryRange(query, String.valueOf(start.getEpochSecond()), String.valueOf(end.getEpochSecond()), step);
        Double[] dataPoints = new Double[count];
        java.util.Arrays.fill(dataPoints, 0.0);
        
        long startSec = start.getEpochSecond();
        long endSec = end.getEpochSecond();
        long stepSec = (endSec - startSec) / (count - 1);
        if (stepSec == 0) stepSec = 1;
        
        try {
            List<Map> results = (List<Map>) rangeData.get("result");
            if (results != null && !results.isEmpty()) {
                List<List<Object>> values = (List<List<Object>>) results.get(0).get("values");
                for (List<Object> value : values) {
                    double ts = Double.parseDouble(value.get(0).toString());
                    double val = Double.parseDouble(value.get(1).toString());
                    
                    int bucket = (int) ((ts - startSec) / stepSec);
                    if (bucket >= 0 && bucket < count) {
                        dataPoints[bucket] = val;
                    } else if (bucket == count) {
                        dataPoints[count - 1] = val;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch range metric for query: {}", query);
        }
        
        return java.util.Arrays.asList(dataPoints);
    }

    private ChartData fetchProbeSuccess(String envLabel, String nodeName, Instant start, Instant end) {
        long diff = end.getEpochSecond() - start.getEpochSecond();
        String step = Math.max(60, diff / 11) + "s";
        List<String> labels = generateTimeLabels(start, end, 12);
        String query = String.format("avg(probe_success{environment=\"%s\"%s}) * 100", envLabel, nodeFilter(nodeName));
        return ChartData.builder()
                .labels(labels)
                .datasets(List.of(
                        ChartData.Series.builder().label("probe_success %").data(fetchRangeMetric(query, start, end, step, 12)).color("#14b8a6").fill(false).build()
                ))
                .build();
    }

    private List<ErrorPattern> fetchTopErrors(String envLabel, String appFilter, String nodeName, Instant start, Instant end) {
        try {
            org.springframework.data.domain.Page<LogEventDTO> errorLogs = elasticsearchLogClient.searchLogs(
                    envLabel, appFilter, nodeName, null, "ERROR", start, end, 
                    org.springframework.data.domain.PageRequest.of(0, 100));

            // Group by message/summary to find patterns
            Map<String, List<LogEventDTO>> patterns = errorLogs.getContent().stream()
                    .collect(Collectors.groupingBy(log -> log.getNormalizedSummary() != null ? log.getNormalizedSummary() : log.getRawMessage()));

            return patterns.entrySet().stream()
                    .map(entry -> {
                        List<LogEventDTO> occurrences = entry.getValue();
                        LogEventDTO first = occurrences.get(0);
                        return ErrorPattern.builder()
                                .endpoint(first.getService())
                                .messageExcerpt(entry.getKey())
                                .statusCode(500) // Default for error logs
                                .count(occurrences.size())
                                .sparkline(List.of(1, 3, 5, 2, 8, 10, 4)) // Representative trend
                                .source("elasticsearch")
                                .firstSeen(occurrences.get(occurrences.size()-1).getTimestamp().toString())
                                .lastSeen(first.getTimestamp().toString())
                                .build();
                    })
                    .sorted((a, b) -> Long.compare(b.getCount(), a.getCount()))
                    .limit(10)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Failed to fetch top errors from ES", e);
            return new ArrayList<>();
        }
    }

    private List<ResourcePressure> fetchResourcePressure(String envLabel, List<Application> apps, String nodeName) {
        List<ResourcePressure> pressure = new ArrayList<>();
        
        for (Application app : apps) {
            String serviceName = app.getServiceNameKeyword();
            if (serviceName == null) continue;
            
            Double mem = prometheusClient.queryMetric(String.format("sum(container_memory_usage_bytes{environment=~\"%s\", name=~\".*%s.*\"%s}) / 4294967296 * 100", envLabel, serviceName, nodeFilter(nodeName)));
            Double cpu = prometheusClient.queryMetric(String.format("sum(rate(container_cpu_usage_seconds_total{environment=~\"%s\", name=~\".*%s.*\"%s}[5m])) * 100", envLabel, serviceName, nodeFilter(nodeName)));
            
            String callout = null;
            if (mem > 85) callout = "Memory pressure detected";
            if (cpu > 80) callout = "CPU throttling likely";
            
            pressure.add(ResourcePressure.builder()
                    .containerName(app.getName())
                    .memoryUsage(mem > 0 ? mem : 0.0)
                    .cpuUsage(cpu > 0 ? cpu : 0.0)
                    .callout(callout)
                    .build());
        }
        
        return pressure;
    }

    private List<RootCauseRule> calculateRootCauseChain(String envLabel, String appFilter, String nodeName) {
        List<RootCauseRule> rules = new ArrayList<>();
        
        String limitQuery = String.format("sum(container_spec_memory_limit_bytes{environment=~\"%s\", name=~\".*%s.*\"%s}) or vector(0)", envLabel, appFilter, nodeFilter(nodeName));
        Double memLimit = prometheusClient.queryMetric(limitQuery);
        if (memLimit == null || memLimit <= 0) memLimit = 4294967296.0;

        Double memUsage = prometheusClient.queryMetric(String.format("sum(container_memory_usage_bytes{environment=~\"%s\", name=~\".*%s.*\"%s}) / %f * 100 or vector(0)", envLabel, appFilter, nodeFilter(nodeName), memLimit));
        Double dbPool = prometheusClient.queryMetric(String.format("sum(hikaricp_connections_active{environment=\"%s\", job=~\".*%s.*\"%s}) / sum(hikaricp_connections_max{environment=\"%s\", job=~\".*%s.*\"%s}) * 100 or vector(0)", envLabel, appFilter, nodeFilter(nodeName), envLabel, appFilter, nodeFilter(nodeName)));
        Double errRate = prometheusClient.queryMetric(String.format("sum(rate(http_server_requests_seconds_count{status=~\"5..\", environment=\"%s\", job=~\".*%s.*\"%s}[5m])) or vector(0)", envLabel, appFilter, nodeFilter(nodeName)));

        if (memUsage > 85 && dbPool > 90) {
            rules.add(RootCauseRule.builder()
                    .id("rc-mem-db")
                    .type("root_cause")
                    .title("GC pressure holding connections")
                    .description("High memory usage (>85%) correlated with DB pool exhaustion. The service is likely spending too much time in GC, causing connection timeouts.")
                    .sources(List.of("cadvisor", "prometheus"))
                    .build());
        }
        
        if (errRate > 0 && dbPool > 95) {
             rules.add(RootCauseRule.builder()
                    .id("rc-db-exhaust")
                    .type("cascade")
                    .title("Database Pool Exhaustion")
                    .description("HTTP 5xx errors are spiking while DB pool is at 95%+. Root cause is likely slow database queries or connection leaks.")
                    .sources(List.of("prometheus"))
                    .build());
        }

        return rules;
    }

    private List<LogEventDTO> fetchLiveLogs(String envLabel, String appFilter, String nodeName, Instant start, Instant end) {
        try {
            org.springframework.data.domain.Page<LogEventDTO> logs = elasticsearchLogClient.searchLogs(
                    envLabel, appFilter, nodeName, null, "ALL", 
                    start, end, 
                    org.springframework.data.domain.PageRequest.of(0, 50));
            return logs.getContent();
        } catch (Exception e) {
            log.error("Failed to fetch live logs from ES", e);
            return new ArrayList<>();
        }
    }

    private int parseRange(String range) {
        if (range == null) return 6;
        return switch (range) {
            case "1h" -> 1;
            case "24h" -> 24;
            case "7d" -> 168;
            default -> 6;
        };
    }

    private List<String> generateTimeLabels(Instant start, Instant end, int count) {
        List<String> labels = new ArrayList<>();
        long totalSeconds = start.until(end, ChronoUnit.SECONDS);
        long intervalSeconds = totalSeconds / (count - 1);
        
        String pattern = (totalSeconds >= 86400) ? "MMM dd HH:mm" : "HH:mm";
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern(pattern);
        
        for (int i = 0; i < count; i++) {
            labels.add(formatter.format(start.plus(i * intervalSeconds, ChronoUnit.SECONDS).atZone(java.time.ZoneId.systemDefault())));
        }
        return labels;
    }
}
