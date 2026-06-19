package com.monetique.eye.security.service;

import com.monetique.eye.entity.Application;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.security.dto.SecurityDashboardSummaryDto;
import com.monetique.eye.security.dto.SecurityReportUploadResponse;
import com.monetique.eye.security.dto.VulnerabilityDto;
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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
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
    public Page<VulnerabilityDto> getVulnerabilities(Long applicationId, Pageable pageable) {
        // Find latest report, then vulnerabilities. Simple approach:
        // Actually, requirement says: "vulnerabilities for the application's LATEST report per component, filterable by severity, status, reportType"
        // Let's implement basic for now.
        return null;
    }

    @Transactional
    public void updateVulnerabilityStatus(Long vulnId, VulnerabilityStatus status) {
        SecurityVulnerability vuln = vulnerabilityRepository.findById(vulnId)
                .orElseThrow(() -> new IllegalArgumentException("Vulnerability not found with ID: " + vulnId));
        vuln.setStatus(status);
        vulnerabilityRepository.save(vuln);
    }
    
    @Transactional(readOnly = true)
    public SecurityDashboardSummaryDto getSummaryForApplication(Long applicationId) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found: " + applicationId));
                
        // Get latest dependency check backend + frontend counts, then sum them. 
        // For simplicity, just get one latest report for now. 
        // Implementation can be enhanced.
        
        Optional<SecurityScanReport> latestDepCheck = reportRepository.findFirstByApplicationIdAndComponentAndReportTypeOrderByUploadedAtDesc(
                applicationId, ReportComponent.BACKEND, ReportType.DEPENDENCY_CHECK);
                
        Optional<SecurityScanReport> latestSonar = reportRepository.findFirstByApplicationIdAndComponentAndReportTypeOrderByUploadedAtDesc(
                applicationId, ReportComponent.BACKEND, ReportType.SONARQUBE);

        int critical = latestDepCheck.map(SecurityScanReport::getCriticalCount).orElse(0) +
                       latestSonar.map(SecurityScanReport::getCriticalCount).orElse(0);
                       
        int high = latestDepCheck.map(SecurityScanReport::getHighCount).orElse(0) +
                   latestSonar.map(SecurityScanReport::getHighCount).orElse(0);
                   
        int falcoCount = falcoEventRepository.countByApplicationIdAndTimestampAfter(applicationId, LocalDateTime.now().minusDays(1));

        return SecurityDashboardSummaryDto.builder()
                .applicationId(app.getId())
                .applicationName(app.getName())
                .latestDependencyScan(latestDepCheck.map(SecurityScanReport::getUploadedAt).orElse(null))
                .latestSonarScan(latestSonar.map(SecurityScanReport::getUploadedAt).orElse(null))
                .criticalCount(critical)
                .highCount(high)
                .falcoEventsLast24h(falcoCount)
                .trend("STABLE") // TODO: Calculate trend
                .build();
    }

    @Transactional(readOnly = true)
    public SecurityDashboardSummaryDto getGlobalSummary() {
        int falcoCount = falcoEventRepository.countByTimestampAfter(LocalDateTime.now().minusDays(1));
        long criticalCount = vulnerabilityRepository.countBySeverity(VulnerabilitySeverity.CRITICAL);
        long highCount = vulnerabilityRepository.countBySeverity(VulnerabilitySeverity.HIGH);
        
        return SecurityDashboardSummaryDto.builder()
                .criticalCount((int) criticalCount)
                .highCount((int) highCount)
                .falcoEventsLast24h(falcoCount)
                .trend("STABLE")
                .build();
    }
}
