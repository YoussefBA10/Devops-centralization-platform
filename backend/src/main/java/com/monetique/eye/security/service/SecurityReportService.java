package com.monetique.eye.security.service;

import com.monetique.eye.dto.ServiceResourceDTO;
import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.Environment;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.security.dto.AttackSurfaceNodeDetailDto;
import com.monetique.eye.security.dto.AttackSurfaceDto;
import com.monetique.eye.security.dto.FalcoEventBriefDto;
import com.monetique.eye.security.dto.ReportCountProjection;
import com.monetique.eye.security.dto.ScanReportTrendProjection;
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
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
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
    private final EnvironmentRepository environmentRepository;
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
        return vulnerabilityRepository.findDtosByApplicationId(applicationId, severity, status, reportType, pageable);
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
        List<ScanReportTrendProjection> projections = reportRepository.findTrendProjectionsByApplicationIds(
                List.of(applicationId));
        return mapTrendProjections(projections, days);
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
        Set<String> addedContainerKeys = new HashSet<>();

        String gatewayId = "gateway-" + environmentId;
        nodes.add(AttackSurfaceDto.AttackSurfaceNode.builder()
                .id(gatewayId)
                .label("Ingress / API Gateway")
                .type("API")
                .status("HEALTHY")
                .build());

        Map<Long, int[]> vulnCountsByApp = new HashMap<>();
        for (Application app : apps) {
            vulnCountsByApp.put(app.getId(), countVulnsForApp(app));
        }

        Set<String> containerKeys = resources.stream()
                .map(r -> r.getServiceName().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
        Map<String, Integer> falcoByContainer = countFalcoByContainer(recentFalco, containerKeys);

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
        }

        for (ServiceResourceDTO resource : resources) {
            String serviceKey = resource.getServiceName().toLowerCase(Locale.ROOT);
            if (!addedContainerKeys.add(serviceKey)) {
                continue;
            }

            Long matchedAppId = matchApplication(apps, resource.getServiceName());
            int[] counts = matchedAppId != null ? vulnCountsByApp.getOrDefault(matchedAppId, new int[]{0, 0}) : new int[]{0, 0};
            int falcoCount = falcoByContainer.getOrDefault(serviceKey, 0);
            boolean isDb = isDatabase(resource.getServiceName());
            String type = isDb ? "DATABASE" : "CONTAINER";
            String status = resolveAssetStatus(counts[0], counts[1], falcoCount);
            boolean atRisk = !"HEALTHY".equals(status);

            if (!atRisk && matchedAppId == null && !isDb) {
                continue;
            }

            String containerId = "container-" + sanitizeId(resource.getServiceName());
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
                addEdge(edges, edgeKeys, "edge-deploy-" + containerId,
                        "service-" + matchedAppId, containerId, "DEPLOYMENT", atRisk);
            } else if (isDb || falcoCount > 0) {
                addEdge(edges, edgeKeys, "edge-gw-db-" + containerId,
                        gatewayId, containerId, "NETWORK", atRisk);
            }
        }

        return AttackSurfaceDto.builder().nodes(nodes).edges(edges).build();
    }

    @Transactional(readOnly = true)
    public SecurityDashboardSummaryDto getSummaryForApplication(Long applicationId) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found: " + applicationId));

        SeverityTotals totals = aggregateLatestReportCountsForApplication(app);
        int falcoCount = falcoEventRepository.countByApplicationIdAndTimestampAfter(applicationId, LocalDateTime.now().minusDays(1));

        ReportComponent component = resolveReportComponent(app);
        Optional<SecurityScanReport> latestDepCheck = reportRepository.findFirstByApplicationIdAndComponentAndReportTypeOrderByUploadedAtDesc(
                applicationId, component, ReportType.DEPENDENCY_CHECK);
        Optional<SecurityScanReport> latestSonar = reportRepository.findFirstByApplicationIdAndComponentAndReportTypeOrderByUploadedAtDesc(
                applicationId, component, ReportType.SONARQUBE);

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
        return getClusterSummary(null);
    }

    @Transactional(readOnly = true)
    public SecurityDashboardSummaryDto getClusterSummary(Long clusterId) {
        List<Application> apps = applicationRepository.findByClusterId(clusterId);
        int falcoCount = falcoEventRepository.countByTimestampAfter(LocalDateTime.now().minusDays(1));

        if (clusterId != null && !apps.isEmpty()) {
            SeverityTotals totals = new SeverityTotals();
            for (Application app : apps) {
                SeverityTotals appTotals = aggregateLatestReportCountsForApplication(app);
                totals.critical += appTotals.critical;
                totals.high += appTotals.high;
                totals.medium += appTotals.medium;
                totals.low += appTotals.low;
            }
            int currentTotal = 0;
            int previousTotal = 0;
            for (Application app : apps) {
                ReportComponent component = resolveReportComponent(app);
                for (ReportType type : ReportType.values()) {
                    Optional<ReportCountProjection> latest = findLatestCountProjection(app.getId(), component, type);
                    if (latest.isPresent()) {
                        ReportCountProjection current = latest.get();
                        currentTotal += safeInt(current.getCriticalCount()) + safeInt(current.getHighCount());
                        previousTotal += findPreviousCountProjection(app.getId(), component, type, current.getId())
                                .map(r -> safeInt(r.getCriticalCount()) + safeInt(r.getHighCount()))
                                .orElse(0);
                    }
                }
            }
            return SecurityDashboardSummaryDto.builder()
                    .criticalCount(totals.critical)
                    .highCount(totals.high)
                    .mediumCount(totals.medium)
                    .lowCount(totals.low)
                    .falcoEventsLast24h(falcoCount)
                    .trend(resolveTrendLabel(currentTotal, previousTotal))
                    .build();
        }

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

    @Transactional(readOnly = true)
    public Page<VulnerabilityDto> getClusterVulnerabilities(Long clusterId, VulnerabilitySeverity severity,
            VulnerabilityStatus status, ReportType reportType, Pageable pageable) {
        return vulnerabilityRepository.findDtosByClusterId(clusterId, severity, status, reportType, pageable);
    }

    @Transactional(readOnly = true)
    public List<SecurityTrendPointDto> getClusterTrends(Long clusterId, int days) {
        List<ScanReportTrendProjection> projections = loadTrendProjectionsForCluster(clusterId);
        return mapTrendProjections(projections, days);
    }

    private List<ScanReportTrendProjection> loadTrendProjectionsForCluster(Long clusterId) {
        if (clusterId == null) {
            return reportRepository.findAllTrendProjections();
        }
        List<Long> appIds = resolveClusterApplications(clusterId).stream()
                .map(Application::getId)
                .collect(Collectors.toList());
        if (!appIds.isEmpty()) {
            List<ScanReportTrendProjection> byApps = reportRepository.findTrendProjectionsByApplicationIds(appIds);
            if (!byApps.isEmpty()) {
                return byApps;
            }
        }
        return reportRepository.findTrendProjectionsByClusterId(clusterId);
    }

    private List<SecurityTrendPointDto> mapTrendProjections(List<ScanReportTrendProjection> projections, int days) {
        List<ScanReportTrendProjection> rows = projections;
        if (days > 0 && !rows.isEmpty()) {
            LocalDateTime since = LocalDateTime.now().minusDays(days);
            List<ScanReportTrendProjection> filtered = rows.stream()
                    .filter(r -> r.getUploadedAt() != null && r.getUploadedAt().isAfter(since))
                    .collect(Collectors.toList());
            if (!filtered.isEmpty()) {
                rows = filtered;
            }
        }
        return dedupeTrendProjections(rows).stream()
                .map(this::toTrendPoint)
                .collect(Collectors.toList());
    }

    /**
     * Keep only the latest scan per application + report type + component + calendar day.
     * Prevents duplicate points when CI uploads multiple reports on the same day.
     */
    private List<ScanReportTrendProjection> dedupeTrendProjections(List<ScanReportTrendProjection> rows) {
        Map<String, ScanReportTrendProjection> latest = new LinkedHashMap<>();
        for (ScanReportTrendProjection row : rows) {
            if (row.getUploadedAt() == null || row.getApplicationId() == null) {
                continue;
            }
            LocalDate day = row.getUploadedAt().toLocalDate();
            String key = row.getApplicationId() + "|" + row.getReportType() + "|" + row.getComponent() + "|" + day;
            latest.merge(key, row, (existing, incoming) ->
                    incoming.getUploadedAt().isAfter(existing.getUploadedAt()) ? incoming : existing);
        }
        return latest.values().stream()
                .sorted(Comparator.comparing(ScanReportTrendProjection::getUploadedAt))
                .collect(Collectors.toList());
    }

    private SecurityTrendPointDto toTrendPoint(ScanReportTrendProjection r) {
        return SecurityTrendPointDto.builder()
                .date(r.getUploadedAt())
                .applicationId(r.getApplicationId())
                .reportType(r.getReportType())
                .component(r.getComponent())
                .buildNumber(r.getBuildNumber())
                .criticalCount(safeInt(r.getCriticalCount()))
                .highCount(safeInt(r.getHighCount()))
                .mediumCount(safeInt(r.getMediumCount()))
                .lowCount(safeInt(r.getLowCount()))
                .totalIssues(resolveTotalIssues(r))
                .applicationName(r.getApplicationName())
                .build();
    }

    private int resolveTotalIssues(ScanReportTrendProjection r) {
        int total = safeInt(r.getTotalIssues());
        if (total > 0) {
            return total;
        }
        return safeInt(r.getCriticalCount()) + safeInt(r.getHighCount())
                + safeInt(r.getMediumCount()) + safeInt(r.getLowCount());
    }

    private List<Environment> resolveClusterEnvironments(Long clusterId) {
        if (clusterId == null) {
            return environmentRepository.findAll();
        }
        List<Environment> envs = environmentRepository.findByCluster_Id(clusterId);
        if (!envs.isEmpty()) {
            return envs;
        }
        return applicationRepository.findByClusterId(clusterId).stream()
                .map(Application::getEnvironment)
                .filter(env -> env != null)
                .collect(Collectors.toMap(Environment::getId, e -> e, (a, b) -> a))
                .values().stream()
                .collect(Collectors.toList());
    }

    private List<Application> resolveClusterApplications(Long clusterId) {
        if (clusterId == null) {
            return applicationRepository.findAll();
        }
        List<Application> apps = new ArrayList<>();
        for (Environment env : resolveClusterEnvironments(clusterId)) {
            apps.addAll(applicationRepository.findByEnvironmentId(env.getId()));
        }
        if (!apps.isEmpty()) {
            return apps;
        }
        return applicationRepository.findByClusterId(clusterId);
    }

    private int resolveTotalIssues(SecurityScanReport r) {
        int total = safeInt(r.getTotalIssues());
        if (total > 0) {
            return total;
        }
        return safeInt(r.getCriticalCount()) + safeInt(r.getHighCount())
                + safeInt(r.getMediumCount()) + safeInt(r.getLowCount());
    }

    private Optional<ReportCountProjection> findLatestCountProjection(
            Long applicationId, ReportComponent component, ReportType type) {
        List<ReportCountProjection> rows = reportRepository.findLatestCountProjections(
                applicationId, component, type, PageRequest.of(0, 1));
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    private Optional<ReportCountProjection> findPreviousCountProjection(
            Long applicationId, ReportComponent component, ReportType type, Long excludeId) {
        List<ReportCountProjection> rows = reportRepository.findPreviousCountProjections(
                applicationId, component, type, excludeId, PageRequest.of(0, 1));
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    @Transactional(readOnly = true)
    public AttackSurfaceDto getClusterAttackSurface(Long clusterId) {
        List<Environment> environments = resolveClusterEnvironments(clusterId);
        List<Application> apps = resolveClusterApplications(clusterId);

        LocalDateTime since24h = LocalDateTime.now().minusDays(1);
        List<FalcoEvent> recentFalco = falcoEventRepository.findByTimestampAfterOrderByTimestampAsc(since24h);

        Map<Long, int[]> vulnCountsByApp = new HashMap<>();
        for (Application app : apps) {
            vulnCountsByApp.put(app.getId(), countVulnsForApp(app));
        }

        List<AttackSurfaceDto.AttackSurfaceNode> nodes = new ArrayList<>();
        List<AttackSurfaceDto.AttackSurfaceEdge> edges = new ArrayList<>();
        Set<String> edgeKeys = new HashSet<>();

        String gatewayId = "gateway";
        nodes.add(AttackSurfaceDto.AttackSurfaceNode.builder()
                .id(gatewayId)
                .label("External Traffic")
                .type("API")
                .status("HEALTHY")
                .build());

        Map<String, List<ServiceResourceDTO>> containersByHost = new java.util.LinkedHashMap<>();
        Map<String, String> hostEnvironment = new HashMap<>();

        for (Environment env : environments) {
            String envName = env.getName();
            try {
                for (ServiceResourceDTO resource : infrastructureService.getEnvironmentServiceResources(env.getId())) {
                    String host = resource.getNodeName() != null && !resource.getNodeName().isBlank()
                            ? resource.getNodeName() : envName;
                    containersByHost.computeIfAbsent(host, k -> new ArrayList<>()).add(resource);
                    hostEnvironment.putIfAbsent(host, envName);
                }
            } catch (Exception e) {
                log.warn("Failed to load Prometheus containers for environment {}: {}", envName, e.getMessage());
            }
        }

        if (containersByHost.isEmpty() && !apps.isEmpty()) {
            for (Application app : apps) {
                String host = app.getTargetNode() != null && !app.getTargetNode().isBlank()
                        ? app.getTargetNode()
                        : (app.getEnvironment() != null ? app.getEnvironment().getName() : "docker-host");
                String serviceName = app.getServiceNameKeyword() != null && !app.getServiceNameKeyword().isBlank()
                        ? app.getServiceNameKeyword() : app.getName();
                ServiceResourceDTO synthetic = ServiceResourceDTO.builder()
                        .serviceName(serviceName)
                        .nodeName(host)
                        .status(app.getStatus() != null ? app.getStatus() : "HEALTHY")
                        .build();
                containersByHost.computeIfAbsent(host, k -> new ArrayList<>()).add(synthetic);
                if (app.getEnvironment() != null) {
                    hostEnvironment.putIfAbsent(host, app.getEnvironment().getName());
                }
            }
        }

        Set<String> containerKeys = new HashSet<>();
        for (List<ServiceResourceDTO> hostContainers : containersByHost.values()) {
            for (ServiceResourceDTO resource : hostContainers) {
                containerKeys.add(resource.getServiceName().toLowerCase(Locale.ROOT));
            }
        }
        Map<String, Integer> falcoByContainer = countFalcoByContainer(recentFalco, containerKeys);

        for (Map.Entry<String, List<ServiceResourceDTO>> hostEntry : containersByHost.entrySet()) {
            String hostName = hostEntry.getKey();
            String hostId = "host-" + sanitizeId(hostName);
            String envName = hostEnvironment.getOrDefault(hostName, "");

            boolean hostAtRisk = false;
            for (ServiceResourceDTO r : hostEntry.getValue()) {
                Long matchedAppId = matchApplication(apps, r.getServiceName());
                int[] counts = matchedAppId != null ? vulnCountsByApp.getOrDefault(matchedAppId, new int[]{0, 0}) : new int[]{0, 0};
                int falcoCount = falcoByContainer.getOrDefault(r.getServiceName().toLowerCase(Locale.ROOT), 0);
                if (counts[0] + counts[1] > 0 || falcoCount > 0) hostAtRisk = true;
            }

            nodes.add(AttackSurfaceDto.AttackSurfaceNode.builder()
                    .id(hostId)
                    .label("Docker Host: " + hostName)
                    .type("DOCKER_HOST")
                    .status(hostAtRisk ? "VULNERABLE" : "HEALTHY")
                    .nodeName(hostName)
                    .environmentName(envName)
                    .dockerHost(hostName)
                    .build());
            addEdge(edges, edgeKeys, "edge-gw-" + hostId, gatewayId, hostId, "NETWORK", hostAtRisk);

            Set<String> seenContainers = new HashSet<>();
            for (ServiceResourceDTO resource : hostEntry.getValue()) {
                String containerKey = resource.getServiceName().toLowerCase(Locale.ROOT);
                if (!seenContainers.add(containerKey)) continue;

                Long matchedAppId = matchApplication(apps, resource.getServiceName());
                Application matchedApp = matchedAppId != null
                        ? apps.stream().filter(a -> a.getId().equals(matchedAppId)).findFirst().orElse(null) : null;
                int[] counts = matchedAppId != null ? vulnCountsByApp.getOrDefault(matchedAppId, new int[]{0, 0}) : new int[]{0, 0};
                int falcoCount = falcoByContainer.getOrDefault(containerKey, 0);
                boolean isDb = isDatabase(resource.getServiceName());
                String type = isDb ? "DATABASE" : "CONTAINER";
                String status = resolveAssetStatus(counts[0], counts[1], falcoCount);
                boolean atRisk = !"HEALTHY".equals(status);

                String containerId = "ctr-" + sanitizeId(hostName + "-" + resource.getServiceName());
                String shortContainerId = resource.getContainerId() != null && resource.getContainerId().length() > 12
                        ? resource.getContainerId().substring(0, 12)
                        : resource.getContainerId();
                String portSuffix = matchedApp != null && matchedApp.getPort() != null
                        ? " : " + matchedApp.getPort() : "";
                String label = matchedApp != null
                        ? resource.getServiceName() + portSuffix + " → " + matchedApp.getName()
                        : resource.getServiceName() + portSuffix;
                if (shortContainerId != null && !shortContainerId.isBlank()) {
                    label += " [" + shortContainerId + "]";
                }
                if (resource.getStatus() != null && !"HEALTHY".equals(resource.getStatus())) {
                    label += " (" + resource.getStatus() + ")";
                }

                nodes.add(AttackSurfaceDto.AttackSurfaceNode.builder()
                        .id(containerId)
                        .label(label)
                        .type(type)
                        .status(status)
                        .criticalVulns(counts[0])
                        .highVulns(counts[1])
                        .falcoEvents24h(falcoCount)
                        .applicationId(matchedAppId)
                        .applicationName(matchedApp != null ? matchedApp.getName() : null)
                        .serviceName(resource.getServiceName())
                        .nodeName(hostName)
                        .port(matchedApp != null ? matchedApp.getPort() : null)
                        .environmentName(envName)
                        .parentId(hostId)
                        .dockerHost(hostName)
                        .build());
                addEdge(edges, edgeKeys, "edge-host-" + containerId, hostId, containerId, "DEPLOYMENT", atRisk);
            }
        }

        return AttackSurfaceDto.builder().nodes(nodes).edges(edges).build();
    }

    @Transactional(readOnly = true)
    public AttackSurfaceNodeDetailDto getAttackSurfaceNodeDetail(String nodeId, Long clusterId) {
        AttackSurfaceDto surface = getClusterAttackSurface(clusterId);
        AttackSurfaceDto.AttackSurfaceNode node = surface.getNodes().stream()
                .filter(n -> nodeId.equals(n.getId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Attack surface node not found: " + nodeId));

        String serviceName = node.getServiceName();
        String applicationName = node.getApplicationName();
        List<String> riskReasons = new ArrayList<>();
        List<String> remediationHints = new ArrayList<>();
        List<VulnerabilityDto> vulnerabilities = new ArrayList<>();
        List<FalcoEventBriefDto> falcoEvents = new ArrayList<>();
        List<AttackSurfaceDto.AttackSurfaceNode> atRiskChildren = new ArrayList<>();

        if ("DOCKER_HOST".equals(node.getType())) {
            atRiskChildren = surface.getNodes().stream()
                    .filter(n -> node.getId().equals(n.getParentId()) && !"HEALTHY".equals(n.getStatus()))
                    .sorted(Comparator.comparing(AttackSurfaceDto.AttackSurfaceNode::getStatus).reversed())
                    .collect(Collectors.toList());
            if (!atRiskChildren.isEmpty()) {
                riskReasons.add(atRiskChildren.size() + " container(s) on this host have security or runtime alerts.");
            } else {
                riskReasons.add("No at-risk containers detected on this host.");
            }
        } else if ("API".equals(node.getType())) {
            long atRisk = surface.getNodes().stream().filter(n -> !"HEALTHY".equals(n.getStatus())).count();
            riskReasons.add("Entry point for external traffic into the cluster.");
            if (atRisk > 0) {
                riskReasons.add(atRisk + " downstream asset(s) flagged as vulnerable or critical.");
            }
        } else {
            buildContainerRiskContext(node, riskReasons, remediationHints, vulnerabilities, falcoEvents);
        }

        return AttackSurfaceNodeDetailDto.builder()
                .node(node)
                .serviceName(serviceName)
                .applicationName(applicationName)
                .riskReasons(riskReasons)
                .vulnerabilities(vulnerabilities)
                .falcoEvents(falcoEvents)
                .atRiskChildren(atRiskChildren)
                .remediationHints(remediationHints)
                .build();
    }

    private void buildContainerRiskContext(
            AttackSurfaceDto.AttackSurfaceNode node,
            List<String> riskReasons,
            List<String> remediationHints,
            List<VulnerabilityDto> vulnerabilities,
            List<FalcoEventBriefDto> falcoEvents) {
        ReportComponent reportComponent = null;
        if (node.getApplicationId() != null) {
            Application app = applicationRepository.findById(node.getApplicationId()).orElse(null);
            if (app != null) {
                reportComponent = resolveReportComponent(app);
                final ReportComponent componentFilter = reportComponent;
                List<VulnerabilityDto> vulns = vulnerabilityRepository.findDtosByApplicationId(
                        node.getApplicationId(), null, VulnerabilityStatus.OPEN, null, PageRequest.of(0, 100))
                        .stream()
                        .filter(v -> v.getComponent() == componentFilter)
                        .filter(v -> v.getSeverity() == VulnerabilitySeverity.CRITICAL
                                || v.getSeverity() == VulnerabilitySeverity.HIGH)
                        .sorted(Comparator.comparing(VulnerabilityDto::getSeverity))
                        .limit(20)
                        .collect(Collectors.toList());
                vulnerabilities.addAll(vulns);
            }
        }

        String containerKey = node.getServiceName() != null
                ? node.getServiceName().toLowerCase(Locale.ROOT) : null;
        if (containerKey != null) {
            LocalDateTime since24h = LocalDateTime.now().minusDays(1);
            List<FalcoEventBriefDto> events = falcoEventRepository.findByTimestampAfterOrderByTimestampAsc(since24h).stream()
                    .filter(e -> matchesRuntimeContainer(e, containerKey))
                    .sorted(Comparator.comparing(FalcoEvent::getTimestamp).reversed())
                    .limit(15)
                    .map(e -> FalcoEventBriefDto.builder()
                            .id(e.getId())
                            .ruleName(e.getRuleName())
                            .priority(e.getPriority())
                            .output(e.getOutput())
                            .timestamp(e.getTimestamp())
                            .build())
                    .collect(Collectors.toList());
            falcoEvents.addAll(events);
        }

        if (node.getApplicationId() == null) {
            riskReasons.add("Container is not linked to an application — vulnerability mapping is unavailable.");
            remediationHints.add("Set serviceNameKeyword on an application to match this container name for scan correlation.");
        } else if (node.getCriticalVulns() > 0) {
            riskReasons.add(node.getCriticalVulns() + " critical finding(s) from latest OWASP / SonarQube scans.");
            remediationHints.add("Review critical CVEs and SonarQube rules — patch dependencies or fix code paths first.");
        }
        if (node.getHighVulns() > 0) {
            riskReasons.add(node.getHighVulns() + " high-severity finding(s) from latest scans.");
            remediationHints.add("Schedule upgrades for high-severity dependencies and address SonarQube hotspots.");
        }
        if (!falcoEvents.isEmpty()) {
            riskReasons.add(falcoEvents.size() + " Falco runtime alert(s) in the last 24 hours.");
            remediationHints.add("Investigate Falco events below — unexpected shells, file writes, or network connections may indicate compromise.");
        }
        if ("CRITICAL".equals(node.getStatus()) && riskReasons.isEmpty()) {
            riskReasons.add("Container marked critical based on combined scan and runtime signals.");
        }
        if (riskReasons.isEmpty() && "HEALTHY".equals(node.getStatus())) {
            riskReasons.add("No critical/high scan findings and no Falco alerts in the last 24 hours.");
        }
    }

    private boolean matchesRuntimeContainer(FalcoEvent event, String containerKey) {
        if (containerKey == null || containerKey.isBlank() || isBuildOrCiEvent(event)) {
            return false;
        }
        String eventContainer = extractContainerName(event);
        if (eventContainer == null) {
            return false;
        }
        return matchesContainerToken(eventContainer.toLowerCase(Locale.ROOT), containerKey.toLowerCase(Locale.ROOT));
    }

    private boolean isBuildOrCiEvent(FalcoEvent event) {
        String container = extractContainerName(event);
        if (container != null) {
            String c = container.toLowerCase(Locale.ROOT);
            if (c.contains("kaniko") || c.contains("jenkins") || c.contains("executor")
                    || c.contains("builder") || c.startsWith("build-")) {
                return true;
            }
        }
        String output = event.getOutput();
        if (output != null) {
            String o = output.toLowerCase(Locale.ROOT);
            if (o.contains("kaniko/executor") || o.contains("jenkins_home/workspace")) {
                return true;
            }
        }
        return false;
    }

    private boolean matchesContainerToken(String eventContainer, String keyword) {
        if (eventContainer.equals(keyword)) {
            return true;
        }
        return eventContainer.startsWith(keyword + "-")
                || eventContainer.startsWith(keyword + "_")
                || eventContainer.endsWith("-" + keyword)
                || eventContainer.endsWith("_" + keyword)
                || eventContainer.contains("-" + keyword + "-")
                || eventContainer.contains("_" + keyword + "_");
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
                findLatestCountProjection(applicationId, component, type).ifPresent(r -> {
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
        Application app = applicationRepository.findById(applicationId).orElse(null);
        if (app == null) {
            return "STABLE";
        }
        ReportComponent component = resolveReportComponent(app);
        int currentTotal = 0;
        int previousTotal = 0;
        for (ReportType type : ReportType.values()) {
            Optional<ReportCountProjection> latest = findLatestCountProjection(applicationId, component, type);
            if (latest.isPresent()) {
                ReportCountProjection current = latest.get();
                currentTotal += safeInt(current.getCriticalCount()) + safeInt(current.getHighCount());
                previousTotal += findPreviousCountProjection(applicationId, component, type, current.getId())
                        .map(r -> safeInt(r.getCriticalCount()) + safeInt(r.getHighCount()))
                        .orElse(0);
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
                    Optional<ReportCountProjection> latest = findLatestCountProjection(app.getId(), component, type);
                    if (latest.isPresent()) {
                        ReportCountProjection current = latest.get();
                        currentTotal += safeInt(current.getCriticalCount()) + safeInt(current.getHighCount());
                        previousTotal += findPreviousCountProjection(app.getId(), component, type, current.getId())
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

    private int[] countVulnsForApp(Application app) {
        SeverityTotals totals = aggregateLatestReportCountsForApplication(app);
        return new int[]{totals.critical, totals.high};
    }

    private SeverityTotals aggregateLatestReportCountsForApplication(Application app) {
        ReportComponent component = resolveReportComponent(app);
        SeverityTotals totals = new SeverityTotals();
        for (ReportType type : ReportType.values()) {
            findLatestCountProjection(app.getId(), component, type).ifPresent(r -> {
                totals.critical += safeInt(r.getCriticalCount());
                totals.high += safeInt(r.getHighCount());
                totals.medium += safeInt(r.getMediumCount());
                totals.low += safeInt(r.getLowCount());
            });
        }
        return totals;
    }

    private ReportComponent resolveReportComponent(Application app) {
        if (app.getType() != null && app.getType().toUpperCase(Locale.ROOT).contains("FRONTEND")) {
            return ReportComponent.FRONTEND;
        }
        return ReportComponent.BACKEND;
    }

    private Map<String, Integer> countFalcoByContainer(List<FalcoEvent> events, Set<String> containerKeys) {
        Map<String, Integer> counts = new HashMap<>();
        for (String key : containerKeys) {
            counts.put(key.toLowerCase(Locale.ROOT), 0);
        }
        for (FalcoEvent event : events) {
            for (String key : containerKeys) {
                if (matchesRuntimeContainer(event, key)) {
                    counts.merge(key.toLowerCase(Locale.ROOT), 1, Integer::sum);
                    break;
                }
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
        if (serviceName == null || serviceName.isBlank()) {
            return null;
        }
        String lower = serviceName.toLowerCase(Locale.ROOT);

        for (Application app : apps) {
            if (app.getServiceNameKeyword() != null
                    && lower.equals(app.getServiceNameKeyword().toLowerCase(Locale.ROOT))) {
                return app.getId();
            }
        }

        Long bestMatch = null;
        int bestLen = 0;
        for (Application app : apps) {
            if (app.getServiceNameKeyword() != null
                    && matchesContainerToken(lower, app.getServiceNameKeyword().toLowerCase(Locale.ROOT))) {
                int len = app.getServiceNameKeyword().length();
                if (len > bestLen) {
                    bestMatch = app.getId();
                    bestLen = len;
                }
            }
        }
        if (bestMatch != null) {
            return bestMatch;
        }

        for (Application app : apps) {
            if (lower.equals(app.getName().toLowerCase(Locale.ROOT))) {
                return app.getId();
            }
        }

        bestLen = 0;
        for (Application app : apps) {
            String name = app.getName().toLowerCase(Locale.ROOT);
            if (matchesContainerToken(lower, name)) {
                if (name.length() > bestLen) {
                    bestMatch = app.getId();
                    bestLen = name.length();
                }
            }
        }
        return bestMatch;
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
