package com.monetique.eye.security.service;

import com.monetique.eye.dto.ServiceResourceDTO;
import com.monetique.eye.entity.Application;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.security.dto.AttackSurfaceDto;
import com.monetique.eye.security.dto.SecurityDashboardSummaryDto;
import com.monetique.eye.security.dto.SecurityReportUploadResponse;
import com.monetique.eye.security.dto.SecurityTrendPointDto;
import com.monetique.eye.security.dto.VulnerabilityDto;
import com.monetique.eye.security.entity.FalcoEvent;
import com.monetique.eye.security.entity.SecurityScanReport;
import com.monetique.eye.security.entity.SecurityVulnerability;
import com.monetique.eye.security.entity.enums.ReportComponent;
import com.monetique.eye.security.entity.enums.ReportType;
import com.monetique.eye.security.entity.enums.VulnerabilitySeverity;
import com.monetique.eye.security.entity.enums.VulnerabilityStatus;
import com.monetique.eye.security.repository.FalcoEventRepository;
import com.monetique.eye.security.repository.SecurityScanReportRepository;
import com.monetique.eye.security.repository.SecurityVulnerabilityRepository;
import com.monetique.eye.security.service.parser.DependencyCheckReportParser;
import com.monetique.eye.security.service.parser.SonarReportParser;
import com.monetique.eye.service.InfrastructureService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SecurityReportService {

    private final SecurityScanReportRepository reportRepository;
    private final SecurityVulnerabilityRepository vulnerabilityRepository;
    private final ApplicationRepository applicationRepository;
    private final FalcoEventRepository falcoEventRepository;
    private final DependencyCheckReportParser dependencyCheckParser;
    private final SonarReportParser sonarParser;
    private final InfrastructureService infrastructureService;

    @Transactional
    public SecurityReportUploadResponse uploadReport(Long applicationId, ReportType reportType, ReportComponent component, String buildNumber, String rawJson) {
        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found with ID: " + applicationId));

        SecurityScanReport report = SecurityScanReport.builder()
                .application(application)
                .reportType(reportType)
                .component(component)
                .buildNumber(buildNumber)
                .rawJson(rawJson)
                .build();

        List<SecurityVulnerability> vulnerabilities;
        if (reportType == ReportType.DEPENDENCY_CHECK) {
            vulnerabilities = dependencyCheckParser.parse(report, rawJson);
        } else if (reportType == ReportType.SONARQUBE) {
            vulnerabilities = sonarParser.parse(report, rawJson);
        } else {
            throw new IllegalArgumentException("Unsupported report type: " + reportType);
        }

        report = reportRepository.save(report);
        vulnerabilityRepository.saveAll(vulnerabilities);

        return SecurityReportUploadResponse.builder()
                .id(report.getId())
                .parsedIssueCount(vulnerabilities.size())
                .criticalCount(report.getCriticalCount())
                .highCount(report.getHighCount())
                .build();
    }

    @Transactional(readOnly = true)
    public Page<SecurityScanReport> getReports(Long applicationId, Pageable pageable) {
        return reportRepository.findByApplicationId(applicationId, pageable);
    }

    @Transactional(readOnly = true)
    public Page<VulnerabilityDto> getVulnerabilities(Long applicationId, VulnerabilitySeverity severity,
            VulnerabilityStatus status, ReportType reportType, Pageable pageable) {
        List<Long> latestReportIds = getLatestReportIds(applicationId, reportType);
        if (latestReportIds.isEmpty()) {
            return Page.empty(pageable);
        }
        return vulnerabilityRepository.findDtosByLatestReports(latestReportIds, severity, status, reportType, pageable);
    }

    @Transactional
    public void updateVulnerabilityStatus(Long vulnId, VulnerabilityStatus status) {
        SecurityVulnerability vuln = vulnerabilityRepository.findById(vulnId)
                .orElseThrow(() -> new IllegalArgumentException("Vulnerability not found with ID: " + vulnId));
        vuln.setStatus(status);
        vulnerabilityRepository.save(vuln);
    }

    @Transactional(readOnly = true)
    public List<SecurityTrendPointDto> getTrends(Long applicationId, int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);
        return reportRepository.findByApplicationIdAndUploadedAtAfterOrderByUploadedAtAsc(applicationId, since)
                .stream()
                .map(r -> SecurityTrendPointDto.builder()
                        .date(r.getUploadedAt())
                        .reportType(r.getReportType())
                        .buildNumber(r.getBuildNumber())
                        .criticalCount(safeInt(r.getCriticalCount()))
                        .highCount(safeInt(r.getHighCount()))
                        .mediumCount(safeInt(r.getMediumCount()))
                        .lowCount(safeInt(r.getLowCount()))
                        .totalIssues(safeInt(r.getTotalIssues()))
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public AttackSurfaceDto getAttackSurface(Long environmentId) {
        List<Application> apps = applicationRepository.findByEnvironmentId(environmentId);
        List<ServiceResourceDTO> resources = infrastructureService.getEnvironmentServiceResources(environmentId);
        LocalDateTime since24h = LocalDateTime.now().minusDays(1);
        List<FalcoEvent> recentFalco = falcoEventRepository.findByTimestampAfterOrderByTimestampAsc(since24h);

        List<AttackSurfaceDto.AttackSurfaceNode> nodes = new ArrayList<>();
        List<AttackSurfaceDto.AttackSurfaceEdge> edges = new ArrayList<>();
        Set<String> edgeKeys = new HashSet<>();

        String gatewayId = "gateway-" + environmentId;
        nodes.add(AttackSurfaceDto.AttackSurfaceNode.builder()
                .id(gatewayId)
                .label("Ingress / API Gateway")
                .type("API")
                .status("HEALTHY")
                .build());

        Map<Long, int[]> vulnCountsByApp = new HashMap<>();
        for (Application app : apps) {
            int[] counts = countVulnsForApp(app.getId());
            vulnCountsByApp.put(app.getId(), counts);
        }

        Map<String, Integer> falcoByContainer = countFalcoByContainer(recentFalco);

        for (Application app : apps) {
            int[] counts = vulnCountsByApp.getOrDefault(app.getId(), new int[]{0, 0});
            String serviceId = "service-" + app.getId();
            String status = resolveAssetStatus(counts[0], counts[1], 0);

            nodes.add(AttackSurfaceDto.AttackSurfaceNode.builder()
                    .id(serviceId)
                    .label(app.getName())
                    .type("SERVICE")
                    .status(status)
                    .criticalVulns(counts[0])
                    .highVulns(counts[1])
                    .applicationId(app.getId())
                    .nodeName(app.getTargetNode())
                    .port(app.getPort())
                    .build());

            addEdge(edges, edgeKeys, "edge-gw-" + serviceId, gatewayId, serviceId, "API_CALL", counts[0] + counts[1] > 0);

            String apiId = "api-" + app.getId();
            nodes.add(AttackSurfaceDto.AttackSurfaceNode.builder()
                    .id(apiId)
                    .label(app.getName() + " API :"+ app.getPort())
                    .type("API")
                    .status(status)
                    .criticalVulns(counts[0])
                    .highVulns(counts[1])
                    .applicationId(app.getId())
                    .nodeName(app.getTargetNode())
                    .port(app.getPort())
                    .build());
            addEdge(edges, edgeKeys, "edge-svc-api-" + app.getId(), serviceId, apiId, "API_CALL", counts[0] + counts[1] > 0);
        }

        for (ServiceResourceDTO resource : resources) {
            String containerId = "container-" + sanitizeId(resource.getContainerId() + "-" + resource.getServiceName());
            int falcoCount = falcoByContainer.getOrDefault(resource.getServiceName().toLowerCase(Locale.ROOT), 0);
            boolean isDb = isDatabase(resource.getServiceName());
            String type = isDb ? "DATABASE" : "CONTAINER";
            String status = falcoCount > 5 ? "CRITICAL" : falcoCount > 0 ? "VULNERABLE" : resource.getStatus();

            Long matchedAppId = matchApplication(apps, resource.getServiceName());
            int[] counts = matchedAppId != null ? vulnCountsByApp.getOrDefault(matchedAppId, new int[]{0, 0}) : new int[]{0, 0};
            if (counts[0] + counts[1] > 0) {
                status = resolveAssetStatus(counts[0], counts[1], falcoCount);
            }

            nodes.add(AttackSurfaceDto.AttackSurfaceNode.builder()
                    .id(containerId)
                    .label(resource.getServiceName())
                    .type(type)
                    .status(status)
                    .criticalVulns(counts[0])
                    .highVulns(counts[1])
                    .falcoEvents24h(falcoCount)
                    .applicationId(matchedAppId)
                    .nodeName(resource.getNodeName())
                    .build());

            if (matchedAppId != null) {
                String serviceId = "service-" + matchedAppId;
                addEdge(edges, edgeKeys, "edge-deploy-" + containerId, serviceId, containerId, "DEPLOYMENT",
                        counts[0] + counts[1] > 0 || falcoCount > 0);
            }
        }

        for (int i = 0; i < nodes.size(); i++) {
            for (int j = i + 1; j < nodes.size(); j++) {
                AttackSurfaceDto.AttackSurfaceNode a = nodes.get(i);
                AttackSurfaceDto.AttackSurfaceNode b = nodes.get(j);
                if (a.getNodeName() != null && a.getNodeName().equals(b.getNodeName())
                        && !a.getId().equals(b.getId())
                        && !"API".equals(a.getType()) && !"API".equals(b.getType())) {
                    boolean vulnerable = a.getCriticalVulns() + a.getHighVulns() + b.getCriticalVulns() + b.getHighVulns() > 0
                            || a.getFalcoEvents24h() + b.getFalcoEvents24h() > 0;
                    addEdge(edges, edgeKeys, "edge-net-" + a.getId() + "-" + b.getId(), a.getId(), b.getId(), "NETWORK", vulnerable);
                }
            }
        }

        return AttackSurfaceDto.builder().nodes(nodes).edges(edges).build();
    }

    @Transactional(readOnly = true)
    public SecurityDashboardSummaryDto getSummaryForApplication(Long applicationId) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found: " + applicationId));

        SeverityTotals totals = aggregateLatestReportCounts(applicationId);
        int falcoCount = falcoEventRepository.countByApplicationIdAndTimestampAfter(applicationId, LocalDateTime.now().minusDays(1));

        Optional<SecurityScanReport> latestDepCheck = reportRepository.findFirstByApplicationIdAndComponentAndReportTypeOrderByUploadedAtDesc(
                applicationId, ReportComponent.BACKEND, ReportType.DEPENDENCY_CHECK);
        Optional<SecurityScanReport> latestSonar = reportRepository.findFirstByApplicationIdAndComponentAndReportTypeOrderByUploadedAtDesc(
                applicationId, ReportComponent.BACKEND, ReportType.SONARQUBE);

        return SecurityDashboardSummaryDto.builder()
                .applicationId(app.getId())
                .applicationName(app.getName())
                .latestDependencyScan(latestDepCheck.map(SecurityScanReport::getUploadedAt).orElse(null))
                .latestSonarScan(latestSonar.map(SecurityScanReport::getUploadedAt).orElse(null))
                .criticalCount(totals.critical)
                .highCount(totals.high)
                .mediumCount(totals.medium)
                .lowCount(totals.low)
                .falcoEventsLast24h(falcoCount)
                .trend(calculateTrend(applicationId))
                .build();
    }

    @Transactional(readOnly = true)
    public SecurityDashboardSummaryDto getGlobalSummary() {
        int falcoCount = falcoEventRepository.countByTimestampAfter(LocalDateTime.now().minusDays(1));
        long criticalCount = vulnerabilityRepository.countBySeverity(VulnerabilitySeverity.CRITICAL);
        long highCount = vulnerabilityRepository.countBySeverity(VulnerabilitySeverity.HIGH);
        long mediumCount = vulnerabilityRepository.countBySeverity(VulnerabilitySeverity.MEDIUM);
        long lowCount = vulnerabilityRepository.countBySeverity(VulnerabilitySeverity.LOW);

        return SecurityDashboardSummaryDto.builder()
                .criticalCount((int) criticalCount)
                .highCount((int) highCount)
                .mediumCount((int) mediumCount)
                .lowCount((int) lowCount)
                .falcoEventsLast24h(falcoCount)
                .trend(calculateGlobalTrend())
                .build();
    }

    private List<Long> getLatestReportIds(Long applicationId, ReportType reportTypeFilter) {
        List<Long> ids = new ArrayList<>();
        for (ReportComponent component : ReportComponent.values()) {
            for (ReportType type : ReportType.values()) {
                if (reportTypeFilter != null && type != reportTypeFilter) {
                    continue;
                }
                reportRepository.findFirstByApplicationIdAndComponentAndReportTypeOrderByUploadedAtDesc(
                        applicationId, component, type).ifPresent(r -> ids.add(r.getId()));
            }
        }
        return ids;
    }

    private SeverityTotals aggregateLatestReportCounts(Long applicationId) {
        SeverityTotals totals = new SeverityTotals();
        for (ReportComponent component : ReportComponent.values()) {
            for (ReportType type : ReportType.values()) {
                reportRepository.findFirstByApplicationIdAndComponentAndReportTypeOrderByUploadedAtDesc(
                        applicationId, component, type).ifPresent(r -> {
                    totals.critical += safeInt(r.getCriticalCount());
                    totals.high += safeInt(r.getHighCount());
                    totals.medium += safeInt(r.getMediumCount());
                    totals.low += safeInt(r.getLowCount());
                });
            }
        }
        return totals;
    }

    private String calculateTrend(Long applicationId) {
        int currentTotal = 0;
        int previousTotal = 0;
        for (ReportComponent component : ReportComponent.values()) {
            for (ReportType type : ReportType.values()) {
                Optional<SecurityScanReport> latest = reportRepository.findFirstByApplicationIdAndComponentAndReportTypeOrderByUploadedAtDesc(
                        applicationId, component, type);
                if (latest.isPresent()) {
                    SecurityScanReport current = latest.get();
                    currentTotal += safeInt(current.getCriticalCount()) + safeInt(current.getHighCount());
                    previousTotal += reportRepository.findFirstByApplicationIdAndComponentAndReportTypeAndIdNotOrderByUploadedAtDesc(
                            applicationId, component, type, current.getId())
                            .map(r -> safeInt(r.getCriticalCount()) + safeInt(r.getHighCount()))
                            .orElse(0);
                }
            }
        }
        return resolveTrendLabel(currentTotal, previousTotal);
    }

    private String calculateGlobalTrend() {
        List<Application> apps = applicationRepository.findAll();
        int currentTotal = 0;
        int previousTotal = 0;
        for (Application app : apps) {
            for (ReportComponent component : ReportComponent.values()) {
                for (ReportType type : ReportType.values()) {
                    Optional<SecurityScanReport> latest = reportRepository.findFirstByApplicationIdAndComponentAndReportTypeOrderByUploadedAtDesc(
                            app.getId(), component, type);
                    if (latest.isPresent()) {
                        SecurityScanReport current = latest.get();
                        currentTotal += safeInt(current.getCriticalCount()) + safeInt(current.getHighCount());
                        previousTotal += reportRepository.findFirstByApplicationIdAndComponentAndReportTypeAndIdNotOrderByUploadedAtDesc(
                                app.getId(), component, type, current.getId())
                                .map(r -> safeInt(r.getCriticalCount()) + safeInt(r.getHighCount()))
                                .orElse(0);
                    }
                }
            }
        }
        return resolveTrendLabel(currentTotal, previousTotal);
    }

    private String resolveTrendLabel(int currentTotal, int previousTotal) {
        if (previousTotal == 0) {
            return currentTotal > 0 ? "WORSENING" : "STABLE";
        }
        double change = ((double) (currentTotal - previousTotal) / previousTotal) * 100;
        if (change > 5) return "WORSENING";
        if (change < -5) return "IMPROVING";
        return "STABLE";
    }

    private int[] countVulnsForApp(Long applicationId) {
        SeverityTotals totals = aggregateLatestReportCounts(applicationId);
        return new int[]{totals.critical, totals.high};
    }

    private Map<String, Integer> countFalcoByContainer(List<FalcoEvent> events) {
        Map<String, Integer> counts = new HashMap<>();
        for (FalcoEvent event : events) {
            String key = extractContainerName(event);
            if (key != null) {
                counts.merge(key.toLowerCase(Locale.ROOT), 1, Integer::sum);
            }
        }
        return counts;
    }

    private String extractContainerName(FalcoEvent event) {
        if (event.getOutputFields() == null) return null;
        Object name = event.getOutputFields().get("container.name");
        if (name == null) name = event.getOutputFields().get("k8s.pod.name");
        if (name == null) name = event.getOutputFields().get("proc.name");
        return name != null ? name.toString() : null;
    }

    private Long matchApplication(List<Application> apps, String serviceName) {
        String lower = serviceName.toLowerCase(Locale.ROOT);
        for (Application app : apps) {
            if (lower.contains(app.getName().toLowerCase(Locale.ROOT))
                    || lower.contains(app.getServiceNameKeyword().toLowerCase(Locale.ROOT))) {
                return app.getId();
            }
        }
        return null;
    }

    private boolean isDatabase(String serviceName) {
        String lower = serviceName.toLowerCase(Locale.ROOT);
        return lower.contains("postgres") || lower.contains("mysql") || lower.contains("mongo")
                || lower.contains("redis") || lower.contains("mariadb") || lower.contains("database")
                || lower.contains("db-") || lower.endsWith("-db");
    }

    private String resolveAssetStatus(int critical, int high, int falcoCount) {
        if (critical > 0 || falcoCount > 10) return "CRITICAL";
        if (high > 0 || falcoCount > 0) return "VULNERABLE";
        return "HEALTHY";
    }

    private void addEdge(List<AttackSurfaceDto.AttackSurfaceEdge> edges, Set<String> keys,
            String id, String source, String target, String type, boolean vulnerable) {
        String key = source + "->" + target;
        if (keys.add(key)) {
            edges.add(AttackSurfaceDto.AttackSurfaceEdge.builder()
                    .id(id).source(source).target(target).type(type).vulnerable(vulnerable).build());
        }
    }

    private String sanitizeId(String raw) {
        return raw.replaceAll("[^a-zA-Z0-9_-]", "-");
    }

    private int safeInt(Integer value) {
        return value != null ? value : 0;
    }

    private static class SeverityTotals {
        int critical;
        int high;
        int medium;
        int low;
    }
}
