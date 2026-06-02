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
import com.monetique.eye.entity.ManagedNode;
import com.monetique.eye.repository.AlertGroupRepository;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.repository.ManagedNodeRepository;
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
    private final AlertGroupRepository alertGroupRepository;
    private final ManagedNodeRepository managedNodeRepository;
    private final RootCauseIntelligenceService rootCauseIntelligenceService;

    public LogAnalyticsResponseDTO getDashboardData(Long environmentId, String range, String serviceName, String nodeName, Long ticketId) {
        // Resolve ticket context if provided
        String effectiveServiceName = serviceName;
        String effectiveNodeName = nodeName;
        Ticket contextTicket = null;

        int hours = parseRange(range);
        Instant end = Instant.now();

        if (ticketId != null) {
            contextTicket = ticketRepository.findById(ticketId).orElse(null);
            if (contextTicket != null) {
                if (contextTicket.getApplication() != null) {
                    effectiveServiceName = contextTicket.getApplication().getServiceNameKeyword() != null ? 
                        contextTicket.getApplication().getServiceNameKeyword() : contextTicket.getApplication().getName();
                }
                if ((effectiveNodeName == null || effectiveNodeName.isBlank()) && contextTicket.getNode() != null) {
                    effectiveNodeName = contextTicket.getNode();
                }
                if (contextTicket.getCreatedAt() != null) {
                    end = contextTicket.getCreatedAt().atZone(java.time.ZoneId.systemDefault()).toInstant();
                }
                log.info("ANALYTICS: Resolved ticket #{} to service={} node={} time={}", ticketId, effectiveServiceName, effectiveNodeName, end);
            }
        }

        String pressureNodeName = (effectiveNodeName != null && !effectiveNodeName.isBlank())
                ? effectiveNodeName.trim()
                : (nodeName != null ? nodeName.trim() : null);
        pressureNodeName = sanitizeNodeContext(pressureNodeName);

        Long resolvedEnvironmentId = environmentId;
        if (contextTicket != null && contextTicket.getEnvironment() != null) {
            resolvedEnvironmentId = contextTicket.getEnvironment().getId();
        }

        Instant start = end.minus(hours, ChronoUnit.HOURS);

        Environment env = environmentRepository.findById(resolvedEnvironmentId).orElse(null);
        String envRegex = buildPrometheusEnvRegex(env);

        ResolvedNode resolvedNode = resolveNode(pressureNodeName, env);
        NodeFilterParts nodeFilters = buildNodeFilters(resolvedNode, env);

        List<Application> relatedApps = buildRelatedApps(resolvedEnvironmentId, effectiveServiceName, serviceName);
        List<Application> pressureApps = filterAppsForNode(relatedApps, resolvedNode);

        String containerEnvLabel = envRegex;
        String appEnvLabel = envRegex;

        List<Application> apps = new ArrayList<>();
        if (effectiveServiceName != null && !effectiveServiceName.isBlank()) {
            Application targetApp = applicationRepository.findByName(effectiveServiceName).orElse(null);
            if (targetApp != null) {
                apps.add(targetApp);
                if (targetApp.getServiceNameKeyword() != null) {
                    applicationRepository.findAllByServiceNameKeyword(targetApp.getServiceNameKeyword())
                        .stream()
                        .filter(a -> !a.getId().equals(targetApp.getId()))
                        .forEach(apps::add);
                }
            }
        }
        
        // Always include all environment apps for broad context as requested
        List<Application> envApps = applicationRepository.findByEnvironmentId(resolvedEnvironmentId);
        for (Application a : envApps) {
            if (!apps.contains(a)) apps.add(a);
        }
        
        // For Spring Boot metrics (HTTP, DB), use a broader filter that matches any app in the env
        String springFilter = apps.isEmpty() ? ".*" : apps.stream()
                .map(Application::getServiceNameKeyword)
                .filter(Objects::nonNull)
                .collect(Collectors.joining("|"));
        if (springFilter.isEmpty()) springFilter = ".*";

        // Restricted appFilter: Only include registered microservices, not infra tools
        // If a specific service is requested, we isolate it. Otherwise, we show everything in the env.
        String appFilter = (serviceName != null && !serviceName.isBlank())
                ? serviceName
                : ((effectiveServiceName != null && !effectiveServiceName.isBlank()) ? effectiveServiceName : springFilter);

        List<String> availableServices = apps.stream()
                .map(Application::getName)
                .distinct()
                .sorted()
                .collect(Collectors.toList());

        log.info("ANALYTICS: environmentId={} resolvedEnvId={} envRegex={} appFilter={} node={} ticket={} window=[{} .. {}]",
                environmentId, resolvedEnvironmentId, envRegex, appFilter, pressureNodeName, ticketId, start, end);

        return LogAnalyticsResponseDTO.builder()
                .summaryCards(fetchSummaryCards(appEnvLabel, springFilter, nodeFilters, containerEnvLabel, appFilter, end))
                .trafficCorrelation(fetchTrafficCorrelation(appEnvLabel, appFilter, nodeFilters, apps, start, end))
                .resourceUsage(fetchResourceUsage(containerEnvLabel, appFilter, nodeFilters, start, end))
                .probeSuccess(fetchProbeSuccess(appEnvLabel, nodeFilters, start, end))
                .topErrors(fetchTopErrors(appEnvLabel, appFilter, pressureNodeName, start, end))
                .resourcePressure(fetchResourcePressure(containerEnvLabel, pressureApps, relatedApps, nodeFilters, resolvedNode, end))
                .rootCauseChain(resolveRootCauseChain(contextTicket, ticketId, appEnvLabel, appFilter, pressureNodeName, start, end))
                .liveLogs(fetchLiveLogs(appEnvLabel, appFilter, pressureNodeName, start, end))
                .availableServices(availableServices)
                .build();
    }

    private record ResolvedNode(String nodeName, String ip, boolean central) {}

    private record NodeFilterParts(String cadvisor, String hostInstance, String nodeId) {
        static NodeFilterParts empty() {
            return new NodeFilterParts("", "", "");
        }

        boolean isScoped() {
            return !cadvisor.isEmpty() || !hostInstance.isEmpty() || !nodeId.isEmpty();
        }

        String hostScope() {
            return hostInstance + nodeId;
        }

        String metricScope() {
            return cadvisor + hostInstance + nodeId;
        }
    }

    /** Ignore Prometheus job names mistaken for node context (e.g. ticket stored "node-exporter"). */
    private String sanitizeNodeContext(String rawNode) {
        if (rawNode == null || rawNode.isBlank()) {
            return null;
        }
        String trimmed = rawNode.trim();
        if (trimmed.equalsIgnoreCase("node-exporter")
                || trimmed.equalsIgnoreCase("node_exporter")
                || trimmed.equalsIgnoreCase("cadvisor")
                || trimmed.equalsIgnoreCase("blackbox")
                || trimmed.equalsIgnoreCase("filebeat")) {
            return null;
        }
        return trimmed;
    }

    private String normalizePrometheusLabelValue(Environment env) {
        if (env == null) {
            return "";
        }
        String raw = env.getPrometheusLabel();
        if (raw != null && raw.contains("=")) {
            raw = raw.substring(raw.indexOf('=') + 1).replace("\"", "").trim();
        }
        if (raw == null || raw.isEmpty()) {
            raw = env.getSafeName();
        }
        return raw;
    }

    /** Regex alternation for environment label — matches SMGS, smgs, env name, etc. */
    private String buildPrometheusEnvRegex(Environment env) {
        if (env == null) {
            return ".+";
        }
        Set<String> variants = new LinkedHashSet<>();
        String label = normalizePrometheusLabelValue(env);
        if (!label.isEmpty()) {
            variants.add(label);
            variants.add(label.toLowerCase(Locale.ROOT));
            variants.add(label.toUpperCase(Locale.ROOT));
        }
        if (env.getName() != null && !env.getName().isBlank()) {
            variants.add(env.getName());
            variants.add(env.getName().toLowerCase(Locale.ROOT));
            variants.add(env.getName().toUpperCase(Locale.ROOT));
        }
        return variants.stream()
                .filter(v -> v != null && !v.isBlank())
                .map(this::promRegexAlternation)
                .collect(Collectors.joining("|"));
    }

    private ResolvedNode resolveNode(String rawNode, Environment env) {
        if (rawNode == null || rawNode.isBlank()) {
            return null;
        }
        String trimmed = rawNode.trim();
        String withoutPrefix = trimmed.startsWith("node-") ? trimmed.substring(5) : trimmed;
        String ip = withoutPrefix.matches("^[0-9][0-9.-]+$") ? withoutPrefix.replace('-', '.') : withoutPrefix;
        String nodeName = trimmed.startsWith("node-") ? trimmed : "node-" + withoutPrefix.replace('.', '-');
        boolean central = "central-node".equalsIgnoreCase(trimmed) || "central-node".equalsIgnoreCase(nodeName);

        if (env != null) {
            Optional<ManagedNode> byName = managedNodeRepository.findByEnvironmentAndNodeName(env, nodeName);
            if (byName.isEmpty() && !ip.equals(withoutPrefix)) {
                byName = managedNodeRepository.findByEnvironmentAndIp(env, ip);
            }
            if (byName.isPresent()) {
                ManagedNode mn = byName.get();
                if (mn.getNodeName() != null) {
                    nodeName = mn.getNodeName();
                }
                if (mn.getIp() != null) {
                    ip = mn.getIp();
                }
                central = "central-node".equalsIgnoreCase(nodeName);
            }
        }

        return new ResolvedNode(nodeName, ip, central);
    }

    /**
     * Builds Prometheus selector fragments — cAdvisor/blackbox use nodename; node_exporter/Spring use instance (IP).
     */
    private NodeFilterParts buildNodeFilters(ResolvedNode resolved, Environment env) {
        if (resolved == null) {
            return NodeFilterParts.empty();
        }
        String trimmed = resolved.nodeName();
        String ip = resolved.ip();
        String withoutPrefix = trimmed.startsWith("node-") ? trimmed.substring(5) : trimmed;

        List<String> cadvisorPatterns = new ArrayList<>();
        cadvisorPatterns.add(promRegexAlternation(trimmed));
        if (!withoutPrefix.equals(trimmed)) {
            cadvisorPatterns.add(promRegexAlternation(withoutPrefix));
        }
        if (ip != null && !ip.isBlank() && ip.matches("^[0-9.]+$")) {
            cadvisorPatterns.add(promRegexAlternation(ip));
        }

        String cadvisor = ", nodename=~\".*(" + String.join("|", cadvisorPatterns) + ").*\"";
        String hostInstance = (ip != null && !ip.isBlank() && ip.matches("^[0-9.]+$"))
                ? ", instance=~\".*" + promRegexAlternation(ip) + ".*\""
                : "";

        String nodeId = "";
        if (env != null) {
            Optional<ManagedNode> mn = managedNodeRepository.findByEnvironmentAndNodeName(env, trimmed);
            if (mn.isEmpty() && ip != null && ip.matches("^[0-9.]+$")) {
                mn = managedNodeRepository.findByEnvironmentAndIp(env, ip);
            }
            if (mn.isPresent()) {
                nodeId = ", node_id=\"" + mn.get().getId() + "\"";
            }
        }

        return new NodeFilterParts(cadvisor, hostInstance, nodeId);
    }

    private String envSelector(String envRegex) {
        if (envRegex == null || envRegex.isBlank() || ".*".equals(envRegex) || ".+".equals(envRegex)) {
            return "environment=~\".+\"";
        }
        return String.format(Locale.US, "environment=~\"%s\"", envRegex.replace("\"", ""));
    }

    private String appHttpRateExpr(String envLabel, String springFilter, NodeFilterParts nf, String extraLabels, String rateWindow) {
        String extra = extraLabels != null ? extraLabels : "";
        String window = rateWindow != null ? rateWindow : "5m";
        String env = envSelector(envLabel);
        String job = String.format(Locale.US, "job=~\".*%s.*\"", springFilter);
        if (!nf.isScoped()) {
            return String.format(Locale.US, "sum(rate(http_server_requests_seconds_count{%s, %s%s}[%s]))", env, job, extra, window);
        }
        List<String> parts = new ArrayList<>();
        if (!nf.hostInstance().isEmpty()) {
            parts.add(String.format(Locale.US, "sum(rate(http_server_requests_seconds_count{%s, %s%s%s}[%s]))", env, job, nf.hostInstance(), extra, window));
        }
        if (!nf.cadvisor().isEmpty()) {
            parts.add(String.format(Locale.US, "sum(rate(http_server_requests_seconds_count{%s, %s%s%s}[%s]))", env, job, nf.cadvisor(), extra, window));
        }
        if (parts.isEmpty()) {
            return String.format(Locale.US, "sum(rate(http_server_requests_seconds_count{%s, %s%s}[%s]))", env, job, extra, window);
        }
        return parts.size() == 1 ? parts.get(0) : String.join(" or ", parts);
    }

    private String prometheusNodeSuffix(NodeFilterParts nf) {
        if (!nf.isScoped()) {
            return "";
        }
        if (!nf.hostScope().isEmpty()) {
            return nf.hostScope();
        }
        return nf.cadvisor();
    }

    /** Instance / node_id selector for node_exporter metrics (not nodename). */
    private String nodeHostSelector(NodeFilterParts nf) {
        return nf != null ? nf.hostScope() : "";
    }

    private String prometheusDiskEnvSelector(String envRegex, String hostScope) {
        String host = hostScope != null ? hostScope : "";
        if (envRegex == null || envRegex.isBlank() || ".+".equals(envRegex)) {
            return "environment=~\".+\"" + host;
        }
        return String.format(Locale.US, "environment=~\"%s\"%s", envRegex.replace("\"", ""), host);
    }

    private String appHikariExpr(String envLabel, String springFilter, NodeFilterParts nf, String numeratorLabels) {
        String env = envSelector(envLabel);
        String job = String.format(Locale.US, "job=~\".*%s.*\"", springFilter);
        if (!nf.isScoped()) {
            return String.format(Locale.US, "sum(hikaricp_connections_active{%s, %s%s})", env, job, numeratorLabels);
        }
        List<String> parts = new ArrayList<>();
        if (!nf.hostInstance().isEmpty()) {
            parts.add(String.format(Locale.US, "sum(hikaricp_connections_active{%s, %s%s%s})", env, job, nf.hostInstance(), numeratorLabels));
        }
        if (!nf.cadvisor().isEmpty()) {
            parts.add(String.format(Locale.US, "sum(hikaricp_connections_active{%s, %s%s%s})", env, job, nf.cadvisor(), numeratorLabels));
        }
        return parts.isEmpty()
                ? String.format(Locale.US, "sum(hikaricp_connections_active{%s, %s%s})", env, job, numeratorLabels)
                : (parts.size() == 1 ? parts.get(0) : String.join(" or ", parts));
    }

    private String nodeMemoryTotalExpr(String envLabel, NodeFilterParts nf) {
        String env = envSelector(envLabel);
        if (!nf.isScoped()) {
            return String.format("max(node_memory_MemTotal_bytes{%s})", env);
        }
        if (!nf.hostScope().isEmpty()) {
            return String.format("max(node_memory_MemTotal_bytes{%s%s})", env, nf.hostScope());
        }
        return String.format("max(node_memory_MemTotal_bytes{%s%s})", env, nf.cadvisor() + nf.nodeId());
    }

    private String containerMemoryPercentExpr(String envLabel, String appFilter, String nodeSelector) {
        String node = nodeSelector != null ? nodeSelector : "";
        return String.format(Locale.US,
                "max(max_over_time(((container_memory_usage_bytes{name=~\".*%s.*\", environment=~\"%s\"%s} / (container_spec_memory_limit_bytes{name=~\".*%s.*\", environment=~\"%s\"%s} > 0)) * 100)[2m:15s])) or " +
                "max(max_over_time(((container_memory_usage_bytes{name=~\".*%s.*\", container_label_env=~\"%s\"%s} / (container_spec_memory_limit_bytes{name=~\".*%s.*\", container_label_env=~\"%s\"%s} > 0)) * 100)[2m:15s]))",
                appFilter, envLabel, node, appFilter, envLabel, node,
                appFilter, envLabel, node, appFilter, envLabel, node);
    }

    private String promRegexAlternation(String value) {
        return value.replace(".", "\\.");
    }

    private List<Application> filterAppsForNode(List<Application> apps, ResolvedNode resolved) {
        if (resolved == null || apps.isEmpty()) {
            return apps;
        }
        String ip = resolved.ip();
        String nodeName = resolved.nodeName();
        String ipDashed = ip != null ? ip.replace('.', '-') : "";

        List<Application> onNode = apps.stream()
                .filter(a -> {
                    String target = a.getTargetNode();
                    if (target == null || target.isBlank()) {
                        return false;
                    }
                    return target.equals(ip)
                            || target.equals(nodeName)
                            || target.replace('.', '-').equals(ipDashed)
                            || ("node-" + target.replace('.', '-')).equals(nodeName);
                })
                .collect(Collectors.toList());

        return onNode.isEmpty() ? apps : onNode;
    }

    private boolean isPrometheusAutoTicket(Ticket ticket) {
        if (ticket == null || ticket.getId() == null) {
            return false;
        }
        if (!alertGroupRepository.findByTicketId(ticket.getId()).isEmpty()) {
            return true;
        }
        String title = ticket.getTitle() != null ? ticket.getTitle() : "";
        String description = ticket.getDescription() != null ? ticket.getDescription() : "";
        return title.startsWith("[ALERT]")
                || description.contains("Automated ticket raised from Prometheus");
    }

    private List<RootCauseRule> resolveRootCauseChain(
            Ticket ticket,
            Long ticketId,
            String envLabel,
            String appFilter,
            String nodeName,
            Instant start,
            Instant end) {
        if (ticketId == null || !isPrometheusAutoTicket(ticket)) {
            return List.of(noPrometheusTicketRule());
        }
        return rootCauseIntelligenceService.analyze(envLabel, appFilter, nodeName, start, end);
    }

    private RootCauseRule noPrometheusTicketRule() {
        return RootCauseRule.builder()
                .id("no-prometheus-ticket")
                .type("no_ticket")
                .title("No incident ticket")
                .description("There is not actual ticket to resolve")
                .confidence("low")
                .probability(0.0)
                .evidence(List.of(
                        "Root cause analysis requires a ticket auto-created from a Prometheus alert",
                        "Select an [ALERT] ticket from the dropdown or wait for Alertmanager to raise one"
                ))
                .sources(List.of("Prometheus", "Alertmanager"))
                .build();
    }

    private List<MetricCard> fetchSummaryCards(String appEnvLabel, String springFilter, NodeFilterParts nodeFilters,
                                                String containerEnvLabel, String appFilter, Instant end) {
        List<MetricCard> cards = new ArrayList<>();
        String cadvisorNode = nodeFilters.cadvisor();
        String nodeMemTotal = nodeMemoryTotalExpr(containerEnvLabel, nodeFilters);

        // 1. Error Rate
        String errNum = appHttpRateExpr(appEnvLabel, springFilter, nodeFilters, ", status=~\"5..\"", "5m");
        String errDen = appHttpRateExpr(appEnvLabel, springFilter, nodeFilters, "", "5m");
        String errRateQuery = String.format(Locale.US, "(%s) / (%s) * 100", errNum, errDen);
        Double errRate = prometheusClient.queryMetric(errRateQuery, end);
        cards.add(MetricCard.builder()
                .label("Error rate")
                .value(String.format("%.2f%%", errRate))
                .delta("")
                .status(errRate > 5 ? "danger" : errRate > 1 ? "warning" : "neutral")
                .source("prometheus")
                .build());

        // 2. Request Rate
        String reqRateQuery = appHttpRateExpr(appEnvLabel, springFilter, nodeFilters, "", "5m");
        Double reqRate = prometheusClient.queryMetric(reqRateQuery, end);
        cards.add(MetricCard.builder()
                .label("Request rate")
                .value(String.format("%.1f req/s", reqRate))
                .delta("")
                .status("neutral")
                .source("prometheus")
                .build());

        // 3. DB Pool Usage
        String dbActive = appHikariExpr(appEnvLabel, springFilter, nodeFilters, "");
        String dbMax = appHikariExpr(appEnvLabel, springFilter, nodeFilters, "").replace("connections_active", "connections_max");
        String dbPoolQuery = String.format(Locale.US, "(%s) / (%s) * 100 or vector(0)", dbActive, dbMax);
        Double dbPool = prometheusClient.queryMetric(dbPoolQuery, end);
        cards.add(MetricCard.builder()
                .label("DB pool usage")
                .value(String.format("%.1f%%", dbPool))
                .delta("")
                .status(dbPool > 90 ? "danger" : dbPool > 70 ? "warning" : "neutral")
                .source("prometheus")
                .build());

        // 4. Memory — backend containers on node, or host RAM when no containers (e.g. standalone smgs nodes)
        String env = envSelector(appEnvLabel);
        String host = nodeHostSelector(nodeFilters);
        String containerMemQuery = containerMemoryPercentExpr(containerEnvLabel, appFilter, cadvisorNode);
        // Always include an env-scoped node_memory fallback so non-containerised environments
        // (e.g. smgs standalone) show real node_exporter RAM even when no specific node is selected.
        String nodeMemFallback = String.format(Locale.US,
                "(100 - (node_memory_MemAvailable_bytes{%s} / node_memory_MemTotal_bytes{%s}) * 100)",
                env, env);
        String processMemQuery = String.format(Locale.US,
                "max(max_over_time(((namedprocess_namegroup_memory_bytes{memtype=\"resident\", environment=~\"%s\", groupname=~\".*%s.*\"%s} / clamp_min(scalar(%s), 1)) * 100)[2m:15s]))",
                containerEnvLabel, appFilter, host, nodeMemTotal);

        String memQuery = "max((" + containerMemQuery + ") or (" + processMemQuery + ") or (" + nodeMemFallback + ") or vector(0))";
        if (nodeFilters.isScoped() && !host.isEmpty()) {
            String unscopedContainerMem = containerMemoryPercentExpr(containerEnvLabel, appFilter, "");
            String unscopedProcessMem = String.format(Locale.US,
                    "max(max_over_time(((namedprocess_namegroup_memory_bytes{memtype=\"resident\", environment=~\"%s\", groupname=~\".*%s.*\"} / clamp_min(scalar(%s), 1)) * 100)[2m:15s]))",
                    containerEnvLabel, appFilter, nodeMemoryTotalExpr(containerEnvLabel, NodeFilterParts.empty()));
            memQuery = String.format(Locale.US,
                    "max((%s) or (100 - (node_memory_MemAvailable_bytes{%s%s} / node_memory_MemTotal_bytes{%s%s}) * 100) or (%s) or (%s) or (%s) or vector(0))",
                    containerMemQuery, env, host, env, host, unscopedContainerMem, unscopedProcessMem, nodeMemFallback);
        }
        Double memUsage = prometheusClient.queryMetric(memQuery, end);
        // Source label: scoped-to-host → node_exporter; otherwise "prometheus" since either cadvisor or
        // node_exporter may have won the `or` chain (e.g. non-containerised smgs nodes).
        String memLabel = nodeFilters.isScoped() && !host.isEmpty() ? "Node memory" : "Memory usage";
        String memSource = nodeFilters.isScoped() && !host.isEmpty() ? "node_exporter" : "prometheus";
        cards.add(MetricCard.builder()
                .label(memLabel)
                .value(String.format("%.1f%%", memUsage))
                .delta("")
                .status(memUsage > 85 ? "danger" : memUsage > 70 ? "warning" : "neutral")
                .source(memSource)
                .build());

        // 5. Blackbox Probe
        String probeQuery = String.format(Locale.US, "avg(probe_success{%s%s}) * 100 or vector(100)",
                envSelector(appEnvLabel), nodeFilters.metricScope());
        Double probeSuccess = prometheusClient.queryMetric(probeQuery, end);
        cards.add(MetricCard.builder()
                .label("Blackbox probe")
                .value(String.format("%.1f%%", probeSuccess))
                .delta("")
                .status(probeSuccess < 95 ? "danger" : "neutral")
                .source("blackbox")
                .build());

        return cards;
    }

    private ChartData fetchTrafficCorrelation(String envLabel, String appFilter, NodeFilterParts nodeFilters, List<Application> apps, Instant start, Instant end) {
        long diff = end.getEpochSecond() - start.getEpochSecond();
        String step = Math.max(60, diff / 11) + "s";
        String rateInterval = Math.max(5, (diff / 60) / 11) + "m";
        List<String> labels = generateTimeLabels(start, end, 12);
        
        List<ChartData.Series> datasets = new ArrayList<>();
        
        // Total Traffic (The primary line)
        datasets.add(ChartData.Series.builder()
                .label("Total req/s")
                .data(fetchRangeMetric(appHttpRateExpr(envLabel, appFilter, nodeFilters, "", rateInterval), start, end, step, 12))
                .color("#3b82f6")
                .fill(false)
                .build());

        // Individual Service Traffic (If looking at multiple apps)
        String nodeSuffix = prometheusNodeSuffix(nodeFilters);
        String envSel = envSelector(envLabel);
        if (".*".equals(appFilter) || apps.size() > 1) {
            datasets.addAll(fetchMultiRangeMetric(
                String.format(Locale.US, "sum by (job) (rate(http_server_requests_seconds_count{%s, job=~\".*%s.*\"%s}[%s]))", envSel, appFilter, nodeSuffix, rateInterval),
                "req/s", start, end, step, 12));
            
            datasets.addAll(fetchMultiRangeMetric(
                String.format(Locale.US, "sum by (job) (rate(http_server_requests_seconds_count{%s, job=~\".*%s.*\", status=~\"5..\"%s}[%s])) * 60", envSel, appFilter, nodeSuffix, rateInterval),
                "errors/min", start, end, step, 12));
        } else {
            datasets.add(ChartData.Series.builder()
                .label("errors/min")
                .data(fetchRangeMetric("(" + appHttpRateExpr(envLabel, appFilter, nodeFilters, ", status=~\"5..\"", rateInterval) + ") * 60", start, end, step, 12))
                .color("#ef4444")
                .fill(true)
                .build());
        }

        // DB Pool (Aggregated)
        String dbActiveRange = appHikariExpr(envLabel, appFilter, nodeFilters, "");
        String dbMaxRange = dbActiveRange.replace("connections_active", "connections_max");
        datasets.add(ChartData.Series.builder()
                .label("DB pool %")
                .data(fetchRangeMetric(String.format(Locale.US, "(%s) / (%s) * 100", dbActiveRange, dbMaxRange), start, end, step, 12))
                .color("#f59e0b")
                .dashed(true)
                .fill(false)
                .build());

        return ChartData.builder()
                .labels(labels)
                .datasets(datasets)
                .build();
    }

    private ChartData fetchResourceUsage(String envLabel, String appFilter, NodeFilterParts nodeFilters, Instant start, Instant end) {
        long diff = end.getEpochSecond() - start.getEpochSecond();
        String step = Math.max(60, diff / 11) + "s";
        String rateInterval = Math.max(5, (diff / 60) / 11) + "m";
        List<String> labels = generateTimeLabels(start, end, 12);
        String cadvisorNode = nodeFilters.cadvisor();
        String env = envSelector(envLabel);
        String host = nodeHostSelector(nodeFilters);

        String containerCpu = String.format(Locale.US,
                "max(sum(rate(container_cpu_usage_seconds_total{environment=~\"%s\", name=~\".*%s.*\"%s}[%s])) * 100)",
                envLabel, appFilter, cadvisorNode, rateInterval);
        // Always include env-scoped host CPU fallback for non-containerised environments (e.g. smgs standalone).
        String hostCpuFallback = String.format(Locale.US,
                "100 - (avg(rate(node_cpu_seconds_total{mode=\"idle\", %s}[%s])) * 100)",
                env, rateInterval);
        String processCpu = String.format(Locale.US,
                "max(sum(rate(namedprocess_namegroup_cpu_seconds_total{environment=~\"%s\", groupname=~\".*%s.*\"%s}[%s])) * 100)",
                envLabel, appFilter, host, rateInterval);
        
        String cpuQuery = String.format(Locale.US, "(%s) or (%s) or (%s)", containerCpu, processCpu, hostCpuFallback);
        if (nodeFilters.isScoped() && !host.isEmpty()) {
            String hostCpu = String.format(Locale.US,
                    "100 - (avg by (instance) (rate(node_cpu_seconds_total{mode=\"idle\", %s%s}[%s])) * 100)",
                    env, host, rateInterval);
            cpuQuery = String.format(Locale.US, "(%s) or (%s) or (%s)", hostCpu, containerCpu, processCpu);
        }

        String nodeMemTotal = nodeMemoryTotalExpr(envLabel, nodeFilters);
        String containerMem = containerMemoryPercentExpr(envLabel, appFilter, cadvisorNode);
        // Always include env-scoped node_memory fallback for non-containerised environments (e.g. smgs standalone).
        String nodeMemFallbackRange = String.format(Locale.US,
                "(1 - (node_memory_MemAvailable_bytes{%s} / node_memory_MemTotal_bytes{%s})) * 100",
                env, env);
        String processMem = String.format(Locale.US,
                "max(max_over_time(((namedprocess_namegroup_memory_bytes{memtype=\"resident\", environment=~\"%s\", groupname=~\".*%s.*\"%s} / clamp_min(scalar(%s), 1)) * 100)[2m:15s]))",
                envLabel, appFilter, host, nodeMemTotal);

        String memQuery = "max((" + containerMem + ") or (" + processMem + ") or (" + nodeMemFallbackRange + ") or vector(0))";
        if (nodeFilters.isScoped() && !host.isEmpty()) {
            String hostMem = String.format(Locale.US,
                    "(1 - (node_memory_MemAvailable_bytes{%s%s} / node_memory_MemTotal_bytes{%s%s})) * 100",
                    env, host, env, host);
            String unscopedContainerMem = containerMemoryPercentExpr(envLabel, appFilter, "");
            String unscopedProcessMem = String.format(Locale.US,
                    "max(max_over_time(((namedprocess_namegroup_memory_bytes{memtype=\"resident\", environment=~\"%s\", groupname=~\".*%s.*\"} / clamp_min(scalar(%s), 1)) * 100)[2m:15s]))",
                    envLabel, appFilter, nodeMemoryTotalExpr(envLabel, NodeFilterParts.empty()));
            memQuery = String.format(Locale.US,
                    "max((%s) or (%s) or (%s) or (%s) or (%s) or vector(0))",
                    hostMem, containerMem, processMem, unscopedContainerMem, unscopedProcessMem);
        }

        String nodeDiskPct = prometheusClient.nodeDiskUsedPercentExpr(prometheusDiskEnvSelector(envLabel, host));
        String containerDisk = String.format(Locale.US,
                "max(max_over_time(((container_fs_usage_bytes{environment=~\"%s\", name=~\".*%s.*\"%s} / (container_fs_limit_bytes{environment=~\"%s\", name=~\".*%s.*\"%s} > 0)) * 100)[2m:15s]))",
                envLabel, appFilter, cadvisorNode, envLabel, appFilter, cadvisorNode);
        String diskQuery = String.format(Locale.US, "%s or max(max_over_time((%s)[2m:15s])) or vector(0)", containerDisk, nodeDiskPct);

        List<ChartData.Series> datasets = List.of(
                ChartData.Series.builder()
                        .label("CPU %")
                        .data(fetchRangeMetric(cpuQuery, start, end, step, 12))
                        .color("#3b82f6")
                        .fill(false)
                        .build(),
                ChartData.Series.builder()
                        .label("Memory %")
                        .data(fetchRangeMetric(memQuery, start, end, step, 12))
                        .color("#10b981")
                        .fill(false)
                        .build(),
                ChartData.Series.builder()
                        .label("Disk %")
                        .data(fetchRangeMetric(diskQuery, start, end, step, 12))
                        .color("#f59e0b")
                        .fill(false)
                        .build()
        );

        return ChartData.builder()
                .labels(labels)
                .datasets(datasets)
                .build();
    }

    private List<ChartData.Series> fetchMultiRangeMetric(String query, String labelSuffix, Instant start, Instant end, String step, int count) {
        List<ChartData.Series> seriesList = new ArrayList<>();
        Map<String, Object> rangeData = prometheusClient.queryRange(query, String.valueOf(start.getEpochSecond()), String.valueOf(end.getEpochSecond()), step);
        
        // Vibrant color palette for microservices (excluding black)
        String[] palette = {"#8b5cf6", "#ec4899", "#10b981", "#06b6d4", "#f97316", "#a855f7", "#14b8a6", "#f43f5e"};
        
        try {
            List<Map> results = (List<Map>) rangeData.get("result");
            if (results != null) {
                int colorIdx = 0;
                for (Map res : results) {
                    Map<String, String> metric = (Map<String, String>) res.get("metric");
                    String job = metric.get("job");
                    if (job == null) job = "unknown";
                    String serviceName = job.replace("monetique-", "").replace("-service", "");
                    
                    Double[] dataPoints = new Double[count];
                    java.util.Arrays.fill(dataPoints, 0.0);
                    
                    List<List<Object>> values = (List<List<Object>>) res.get("values");
                    long startSec = start.getEpochSecond();
                    long endSec = end.getEpochSecond();
                    long stepSec = Math.max(1, (endSec - startSec) / (count - 1));

                    for (List<Object> value : values) {
                        double ts = Double.parseDouble(value.get(0).toString());
                        double val = Double.parseDouble(value.get(1).toString());
                        int bucket = (int) ((ts - startSec) / stepSec);
                        if (bucket >= 0 && bucket < count) {
                            dataPoints[bucket] = val;
                        }
                    }

                    boolean isErrorSeries = labelSuffix.toLowerCase().contains("error");
                    seriesList.add(ChartData.Series.builder()
                            .label(serviceName + " " + labelSuffix)
                            .data(java.util.Arrays.asList(dataPoints))
                            .color(isErrorSeries ? "#ef4444" : palette[colorIdx % palette.length])
                            .fill(isErrorSeries)
                            .build());
                    
                    if (!isErrorSeries) colorIdx++;
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch multi-range metric: {}", e.getMessage());
        }
        return seriesList;
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

    private ChartData fetchProbeSuccess(String envLabel, NodeFilterParts nodeFilters, Instant start, Instant end) {
        long diff = end.getEpochSecond() - start.getEpochSecond();
        String step = Math.max(60, diff / 11) + "s";
        List<String> labels = generateTimeLabels(start, end, 12);
        String query = String.format(Locale.US, "avg(probe_success{%s%s}) * 100",
                envSelector(envLabel), nodeFilters.metricScope());
        return ChartData.builder()
                .labels(labels)
                .datasets(List.of(
                        ChartData.Series.builder().label("probe_success %").data(fetchRangeMetric(query, start, end, step, 12)).color("#14b8a6").fill(false).build()
                ))
                .build();
    }

    /**
     * Normalize an error message by stripping variable parts (timestamps, IPs, durations, UUIDs)
     * so that repeated occurrences of the same root error group together.
     */
    private String normalizeErrorKey(String msg) {
        if (msg == null) return "Unknown Error";
        String key = msg;
        // Strip category prefix like "[NETWORK] " or "[APPLICATION] "
        key = key.replaceAll("^\\[\\w+\\]\\s*", "");
        // Strip ISO timestamps with optional timezone offsets (2026-05-14T21:52:39.616+01:00)
        key = key.replaceAll("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?([+-]\\d{2}:?\\d{2}|Z)?", "<time>");
        // Strip common log pattern artifacts: [ thread-name ]
        key = key.replaceAll("--- \\[[^\\]]+\\]", "--- [<thread>]");
        // Strip log levels
        key = key.replaceAll("\\b(ERROR|WARN|INFO|DEBUG|TRACE)\\b", "<level>");
        // Strip memory addresses/hashes (e.g. @7f8a9b)
        key = key.replaceAll("@[0-9a-f]{6,16}", "@<addr>");
        // Strip epoch-style timestamps
        key = key.replaceAll("\\b\\d{10,13}\\b", "<ts>");
        // Strip IPs
        key = key.replaceAll("\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}(:\\d+)?", "<ip>");
        // Strip durations like duration_seconds=0.001416494
        key = key.replaceAll("duration_seconds=\\d+\\.\\d+", "duration_seconds=<dur>");
        // Strip UUIDs
        key = key.replaceAll("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "<uuid>");
        // Collapse whitespace
        key = key.replaceAll("\\s+", " ").trim();
        // Truncate to 200 chars to avoid overly long keys
        if (key.length() > 200) key = key.substring(0, 200);
        return key;
    }

    private String extractEndpoint(LogEventDTO log, Map<String, String> serviceTopUris) {
        String service = log.getService() != null ? log.getService() : "unknown";
        String category = log.getCategory() != null ? log.getCategory() : "APPLICATION";
        
        // 1. Trust explicit URI metadata if available (the industry standard for structured logs)
        if (log.getUri() != null && !log.getUri().isBlank()) {
            String normalized = log.getUri().replaceAll("\\s+", "");
            if (!"/**".equals(normalized) && !"/ **".equals(normalized)) {
                return log.getUri();
            }
        }

        // 2. Fallback to heuristic parsing of the log message (for legacy apps)
        String msg = log.getRawMessage();
        if (msg != null) {
            // Look for standard patterns like "GET /path"
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\b(GET|POST|PUT|DELETE|PATCH)\\s+([^\\s?\":,]+)").matcher(msg);
            if (m.find()) {
                String path = m.group(2);
                if (!"/**".equals(path)) return path;
            }
        }

        // 3. Fallback to Service Name + Category
        // This is the most honest representation when the exact request context is missing.
        if ("APPLICATION".equals(category)) {
            return service;
        }
        return service + " [" + category + "]";
    }

    private Map<String, String> getServiceTopErrorUris(Instant start, Instant end) {
        Map<String, String> mapping = new HashMap<>();
        try {
            // Get URIs with errors, prioritizing 5xx
            // Query 1: Top 5xx URIs
            String query5xx = "sum by (job, uri) (increase(http_server_requests_seconds_count{status=~\"5..\"}[24h])) > 0";
            List<Map<String, Object>> results5xx = prometheusClient.queryList(query5xx);
            
            Map<String, Double> maxCounts = new HashMap<>();
            
            for (Map<String, Object> res : results5xx) {
                Map<String, String> metric = (Map<String, String>) res.get("metric");
                String job = metric.get("job");
                String uri = metric.get("uri");
                double val = Double.parseDouble(res.get("value").toString());
                
                if (job != null && uri != null && !"/**".equals(uri) && !"/ **".equals(uri.replaceAll("\\s+", ""))) {
                    String simpleJob = job.replace("monetique-", "").replace("-service", "");
                    if (val > maxCounts.getOrDefault(simpleJob, -1.0)) {
                        maxCounts.put(simpleJob, val);
                        mapping.put(simpleJob, uri);
                    }
                }
            }
            
            // Query 2: Fallback to 4xx if no 5xx URIs found for a service
            String query4xx = "sum by (job, uri) (increase(http_server_requests_seconds_count{status=~\"4..\"}[24h])) > 0";
            List<Map<String, Object>> results4xx = prometheusClient.queryList(query4xx);
            for (Map<String, Object> res : results4xx) {
                Map<String, String> metric = (Map<String, String>) res.get("metric");
                String job = metric.get("job");
                String uri = metric.get("uri");
                double val = Double.parseDouble(res.get("value").toString());
                
                if (job != null && uri != null && !"/**".equals(uri) && !"/ **".equals(uri.replaceAll("\\s+", ""))) {
                    String simpleJob = job.replace("monetique-", "").replace("-service", "");
                    if (!mapping.containsKey(simpleJob) && val > maxCounts.getOrDefault(simpleJob, -1.0)) {
                        maxCounts.put(simpleJob, val);
                        mapping.put(simpleJob, uri);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch top error URIs from Prometheus: {}", e.getMessage());
        }
        return mapping;
    }

    private List<ErrorPattern> fetchTopErrors(String envLabel, String appFilter, String nodeName, Instant start, Instant end) {
        try {
            // Fetch top error URIs from Prometheus to help map logs to endpoints
            Map<String, String> serviceTopUris = getServiceTopErrorUris(start, end);

            org.springframework.data.domain.Page<LogEventDTO> errorLogs = elasticsearchLogClient.searchLogs(
                    envLabel, appFilter, nodeName, null, "ERROR", start, end, 
                    org.springframework.data.domain.PageRequest.of(0, 500));

            // Filter out stack trace continuation lines — these are noise, not top-level errors
            List<LogEventDTO> meaningfulErrors = errorLogs.getContent().stream()
                    .filter(log -> {
                        String msg = log.getRawMessage() != null ? log.getRawMessage().trim() : "";
                        // Skip Java stack trace continuation lines
                        if (msg.startsWith("at ") || msg.startsWith("...") || msg.startsWith("Caused by:")) return false;
                        // Skip lines that are just class names with line numbers (e.g. "java.lang.Thread.run(Unknown Source)")
                        if (msg.matches("^[a-z]+\\..*\\(.*\\.java:\\d+\\).*")) return false;
                        return true;
                    })
                    .collect(Collectors.toList());

            // Group by normalized message pattern (strips timestamps/IPs so duplicates merge)
            Map<String, List<LogEventDTO>> patterns = meaningfulErrors.stream()
                    .collect(Collectors.groupingBy(log -> {
                        String service = log.getService() != null ? log.getService() : "unknown";
                        String endpoint = extractEndpoint(log, serviceTopUris);
                        String msg = log.getNormalizedSummary() != null ? log.getNormalizedSummary() : log.getRawMessage();
                        return service + "::" + endpoint + "::" + normalizeErrorKey(msg);
                    }));
            return patterns.entrySet().stream()
                    .map(entry -> {
                        List<LogEventDTO> occurrences = entry.getValue();
                        LogEventDTO first = occurrences.get(0);
                        
                        // Calculate actual trend (sparkline) across 7 buckets
                        long diff = end.getEpochSecond() - start.getEpochSecond();
                        long stepSec = Math.max(1, diff / 7);
                        long[] sparkline = new long[7];
                        for (LogEventDTO logEvent : occurrences) {
                            int bucket = (int) ((logEvent.getTimestamp().getEpochSecond() - start.getEpochSecond()) / stepSec);
                            if (bucket >= 0 && bucket < 7) {
                                sparkline[bucket]++;
                            } else if (bucket == 7) {
                                sparkline[6]++;
                            }
                        }
                        List<Integer> sparklineList = java.util.Arrays.stream(sparkline).mapToInt(l -> (int)l).boxed().collect(Collectors.toList());

                        int statusCode = 500;
                        try {
                            if (first.getErrorType() != null && first.getErrorType().matches("\\d{3}")) {
                                statusCode = Integer.parseInt(first.getErrorType());
                            }
                        } catch (Exception e) {}

                        // Use extracted endpoint as label
                        String endpoint = extractEndpoint(first, serviceTopUris);

                        // Build a clean excerpt (use original message, not the normalized key)
                        String excerpt = first.getNormalizedSummary() != null ? first.getNormalizedSummary() : first.getRawMessage();
                        if (excerpt != null && excerpt.length() > 120) {
                            excerpt = excerpt.substring(0, 120) + "...";
                        }

                        return ErrorPattern.builder()
                                .service(first.getService() != null ? first.getService() : "unknown")
                                .endpoint(endpoint)
                                .messageExcerpt(excerpt)
                                .statusCode(statusCode)
                                .count(occurrences.size())
                                .sparkline(sparklineList)
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

    private List<Application> buildRelatedApps(Long environmentId, String effectiveServiceName, String requestServiceName) {
        String filterName = (requestServiceName != null && !requestServiceName.isBlank())
                ? requestServiceName
                : effectiveServiceName;

        if (filterName == null || filterName.isBlank()) {
            return applicationRepository.findByEnvironmentId(environmentId);
        }

        List<Application> related = new ArrayList<>();
        applicationRepository.findByNameIgnoreCaseAndEnvironmentId(filterName, environmentId).ifPresent(related::add);
        if (related.isEmpty()) {
            applicationRepository.findByName(filterName).ifPresent(related::add);
        }

        if (!related.isEmpty()) {
            Application target = related.get(0);
            if (target.getServiceNameKeyword() != null) {
                applicationRepository.findAllByServiceNameKeyword(target.getServiceNameKeyword()).stream()
                        .filter(a -> a.getEnvironment() != null && environmentId.equals(a.getEnvironment().getId()))
                        .filter(a -> !related.contains(a))
                        .forEach(related::add);
            }
            return related;
        }

        return applicationRepository.findAllByServiceNameKeyword(filterName).stream()
                .filter(a -> a.getEnvironment() != null && environmentId.equals(a.getEnvironment().getId()))
                .collect(Collectors.toList());
    }

    private List<ResourcePressure> fetchResourcePressure(
            String envLabel,
            List<Application> pressureApps,
            List<Application> fallbackApps,
            NodeFilterParts nodeFilters,
            ResolvedNode resolvedNode,
            Instant end) {
        List<ResourcePressure> pressure = new ArrayList<>();
        String nodePart = prometheusNodeSuffix(nodeFilters);
        String nodeMemTotal = nodeMemoryTotalExpr(envLabel, nodeFilters);

        List<Application> apps = !pressureApps.isEmpty() ? pressureApps : fallbackApps;
        for (Application app : apps) {
            String serviceName = app.getServiceNameKeyword();
            if (serviceName == null) continue;

            Double cpu = prometheusClient.queryMetric(String.format(Locale.US,
                    "avg_over_time((sum(rate(container_cpu_usage_seconds_total{environment=~\"%s\", name=~\".*%s.*\"%s}[1m])) * 100)[2m:15s]) or " +
                    "avg_over_time((sum(rate(namedprocess_namegroup_cpu_seconds_total{environment=~\"%s\", groupname=~\".*%s.*\"%s}[1m])) * 100)[2m:15s]) or vector(0)",
                    envLabel, serviceName, nodePart, envLabel, serviceName, nodePart), end);

            Double mem = prometheusClient.queryMetric(String.format(Locale.US,
                    "max(avg_over_time(((container_memory_usage_bytes{name=~\".*%s.*\", environment=~\"%s\"%s} / (container_spec_memory_limit_bytes{name=~\".*%s.*\", environment=~\"%s\"%s} > 0)) * 100)[2m:15s])) or " +
                    "max(avg_over_time(((container_memory_usage_bytes{name=~\".*%s.*\", container_label_env=~\"%s\"%s} / (container_spec_memory_limit_bytes{name=~\".*%s.*\", container_label_env=~\"%s\"%s} > 0)) * 100)[2m:15s])) or " +
                    "max(avg_over_time(((namedprocess_namegroup_memory_bytes{memtype=\"resident\", groupname=~\".*%s.*\", environment=~\"%s\"%s} / clamp_min(scalar(%s), 1)) * 100)[2m:15s])) or vector(0)",
                    serviceName, envLabel, nodePart, serviceName, envLabel, nodePart,
                    serviceName, envLabel, nodePart, serviceName, envLabel, nodePart,
                    serviceName, envLabel, nodePart, nodeMemTotal), end);

            Double disk = fetchAvgDiskUsagePercent(serviceName, envLabel, nodePart, end);

            if (cpu <= 0 && mem <= 0 && disk <= 0) {
                continue;
            }

            String callout = null;
            if (disk > 90) callout = "Disk pressure critical";
            else if (mem > 85) callout = "Memory pressure detected";
            else if (cpu > 80) callout = "CPU throttling likely";

            pressure.add(ResourcePressure.builder()
                    .containerName(app.getName())
                    .memoryUsage(mem > 0 ? mem : 0.0)
                    .cpuUsage(cpu > 0 ? cpu : 0.0)
                    .diskUsage(disk > 0 ? disk : 0.0)
                    .callout(callout)
                    .build());
        }

        // Always add a host-level entry when no container pressure was found.
        // For unscoped queries (no specific node), use empty NodeFilterParts so the query filters
        // by environment only — this ensures non-containerised envs like smgs show real node data.
        if (pressure.isEmpty()) {
            if (resolvedNode != null && nodeFilters.isScoped()) {
                pressure.add(fetchHostResourcePressure(envLabel, nodeFilters, resolvedNode, end));
            } else {
                // Env-wide fallback: aggregate host metrics across the whole environment.
                ResourcePressure envPressure = fetchHostResourcePressure(envLabel, NodeFilterParts.empty(), null, end);
                if (envPressure.getCpuUsage() > 0 || envPressure.getMemoryUsage() > 0 || envPressure.getDiskUsage() > 0) {
                    pressure.add(envPressure);
                }
            }
        }

        return pressure;
    }

    private ResourcePressure fetchHostResourcePressure(String envLabel, NodeFilterParts nodeFilters, ResolvedNode resolvedNode, Instant end) {
        String env = envSelector(envLabel);
        String host = nodeHostSelector(nodeFilters);
        if (host.isEmpty()) {
            host = nodeFilters.cadvisor() + nodeFilters.nodeId();
        }
        // When host is still empty (unscoped env-level fallback), disk is queried via env selector only.
        String diskHostPart = host;

        Double cpu = prometheusClient.queryMetric(String.format(Locale.US,
                "avg_over_time((100 - (avg by (instance) (rate(node_cpu_seconds_total{mode=\"idle\", %s%s}[1m])) * 100))[2m:15s])",
                env, host), end);

        Double mem = prometheusClient.queryMetric(String.format(Locale.US,
                "avg_over_time((100 - (node_memory_MemAvailable_bytes{%s%s} / node_memory_MemTotal_bytes{%s%s}) * 100))[2m:15s])",
                env, host, env, host), end);

        Double disk = 0.0;
        String diskHost = diskHostPart.isEmpty() ? "" : diskHostPart;
        String diskSelector = prometheusDiskEnvSelector(envLabel, diskHost);
        String nodeDiskPct = prometheusClient.nodeDiskUsedPercentExpr(diskSelector);
        disk = prometheusClient.queryMetric(String.format(Locale.US, "avg_over_time((%s)[2m:15s])", nodeDiskPct), end);

        String callout = null;
        if (disk > 90) callout = "Disk pressure critical";
        else if (mem > 85) callout = "Memory pressure detected";
        else if (cpu > 80) callout = "CPU throttling likely";

        // resolvedNode may be null for env-wide (unscoped) fallback queries
        String displayName = (resolvedNode != null)
                ? resolvedNode.nodeName() + " (host)"
                : envLabel + " (env average)";

        return ResourcePressure.builder()
                .containerName(displayName)
                .memoryUsage(mem > 0 ? mem : 0.0)
                .cpuUsage(cpu > 0 ? cpu : 0.0)
                .diskUsage(disk > 0 ? disk : 0.0)
                .callout(callout)
                .build();
    }

    private Double fetchAvgDiskUsagePercent(String serviceName, String envLabel, String nodePart, Instant end) {
        String containerQuery = String.format(Locale.US,
                "avg_over_time((max(((container_fs_usage_bytes{name=~\".*%s.*\", environment=~\"%s\"%s} / (container_fs_limit_bytes{name=~\".*%s.*\", environment=~\"%s\"%s} > 0)) * 100))[2m:15s]) or " +
                "avg_over_time((max(((container_fs_usage_bytes{name=~\".*%s.*\", container_label_env=~\"%s\"%s} / (container_fs_limit_bytes{name=~\".*%s.*\", container_label_env=~\"%s\"%s} > 0)) * 100))[2m:15s])",
                serviceName, envLabel, nodePart, serviceName, envLabel, nodePart,
                serviceName, envLabel, nodePart, serviceName, envLabel, nodePart);
        Double containerDisk = prometheusClient.queryMetric(containerQuery, end);
        if (containerDisk > 0.0) {
            return containerDisk;
        }

        String nodeDiskPct = prometheusClient.nodeDiskUsedPercentExpr(String.format(Locale.US, "environment=\"%s\"", envLabel));
        String nodeQuery = String.format(Locale.US, "avg_over_time((max(%s))[2m:15s])", nodeDiskPct);
        return prometheusClient.queryMetric(nodeQuery, end);
    }

    private List<LogEventDTO> fetchLiveLogs(String envLabel, String appFilter, String nodeName, Instant start, Instant end) {
        try {
            org.springframework.data.domain.Page<LogEventDTO> logsPage = elasticsearchLogClient.searchLogs(
                    envLabel, appFilter, nodeName, null, "ALL", 
                    start, end, 
                    org.springframework.data.domain.PageRequest.of(0, 100));
            
            List<LogEventDTO> rawLogs = logsPage.getContent();
            List<LogEventDTO> grouped = new ArrayList<>();
            
            // Process in chronological order (reverse of DESC) for easy merging
            List<LogEventDTO> chronoLogs = new ArrayList<>(rawLogs);
            java.util.Collections.reverse(chronoLogs);
            
            for (LogEventDTO log : chronoLogs) {
                if (grouped.isEmpty()) {
                    grouped.add(log);
                    continue;
                }
                
                LogEventDTO last = grouped.get(grouped.size() - 1);
                boolean sameOrigin = java.util.Objects.equals(last.getService(), log.getService()) && 
                                   java.util.Objects.equals(last.getNode(), log.getNode());
                
                String msg = log.getRawMessage() != null ? log.getRawMessage().trim() : "";
                boolean isContinuation = msg.startsWith("at ") || msg.startsWith("Caused by:") || 
                                       msg.startsWith("...") || !msg.matches("^([0-9]{4}-|time=).*");
                
                // Merge if very close in time (<200ms) and looks like a continuation
                if (sameOrigin && isContinuation && 
                    Math.abs(log.getTimestamp().toEpochMilli() - last.getTimestamp().toEpochMilli()) < 200) {
                    last.setRawMessage(last.getRawMessage() + "\n" + log.getRawMessage());
                } else {
                    grouped.add(log);
                }
            }
            
            java.util.Collections.reverse(grouped);
            return grouped.stream().limit(50).collect(Collectors.toList());
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
