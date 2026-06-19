package com.monetique.eye.security.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.monetique.eye.security.dto.AttackSurfaceDto;
import com.monetique.eye.security.dto.SecurityDashboardSummaryDto;
import com.monetique.eye.security.dto.SecurityReportUploadResponse;
import com.monetique.eye.security.dto.SecurityTrendPointDto;
import com.monetique.eye.security.dto.VulnerabilityDto;
import com.monetique.eye.security.entity.SecurityScanReport;
import com.monetique.eye.security.entity.enums.ReportComponent;
import com.monetique.eye.security.entity.enums.ReportType;
import com.monetique.eye.security.entity.enums.VulnerabilitySeverity;
import com.monetique.eye.security.entity.enums.VulnerabilityStatus;
import com.monetique.eye.security.service.SecurityReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/security")
@RequiredArgsConstructor
public class SecurityReportController {

    private final SecurityReportService securityReportService;
    private final ObjectMapper objectMapper;

    @Value("${monetique.security.api-key:default-dev-key}")
    private String expectedApiKey;

    @PostMapping(value = "/reports/upload")
    public ResponseEntity<?> uploadReport(
            @RequestHeader(value = "X-API-Key", required = false) String apiKey,
            @RequestParam("applicationId") Long applicationId,
            @RequestParam("reportType") ReportType reportType,
            @RequestParam("component") ReportComponent component,
            @RequestParam("buildNumber") String buildNumber,
            @RequestBody(required = false) String rawJsonBody,
            @RequestParam(value = "file", required = false) MultipartFile file) {

        if (!expectedApiKey.equals(apiKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid API Key");
        }

        try {
            String jsonToParse;
            if (file != null && !file.isEmpty()) {
                jsonToParse = new String(file.getBytes(), StandardCharsets.UTF_8);
            } else if (rawJsonBody != null && !rawJsonBody.isEmpty()) {
                jsonToParse = rawJsonBody;
            } else {
                return ResponseEntity.badRequest().body("Must provide either 'file' multipart or JSON body");
            }

            SecurityReportUploadResponse response = securityReportService.uploadReport(
                    applicationId, reportType, component, buildNumber, jsonToParse);

            return ResponseEntity.ok(response);
        } catch (IOException e) {
            log.error("Failed to read report file", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Failed to read report file");
        } catch (Exception e) {
            log.error("Error processing security report upload", e);
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    @GetMapping("/reports/{applicationId}")
    public ResponseEntity<Page<SecurityScanReport>> getReports(
            @PathVariable Long applicationId,
            Pageable pageable) {
        return ResponseEntity.ok(securityReportService.getReports(applicationId, pageable));
    }

    @GetMapping("/vulnerabilities/{applicationId}")
    public ResponseEntity<Page<VulnerabilityDto>> getVulnerabilities(
            @PathVariable Long applicationId,
            @RequestParam(required = false) VulnerabilitySeverity severity,
            @RequestParam(required = false) VulnerabilityStatus status,
            @RequestParam(required = false) ReportType reportType,
            Pageable pageable) {
        return ResponseEntity.ok(securityReportService.getVulnerabilities(applicationId, severity, status, reportType, pageable));
    }

    @PatchMapping("/vulnerabilities/{vulnId}/status")
    public ResponseEntity<Void> updateVulnerabilityStatus(
            @PathVariable Long vulnId,
            @RequestBody Map<String, String> body) {
        String statusStr = body.get("status");
        if (statusStr != null) {
            securityReportService.updateVulnerabilityStatus(vulnId, VulnerabilityStatus.valueOf(statusStr));
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/dashboard/summary/{applicationId}")
    public ResponseEntity<SecurityDashboardSummaryDto> getSummaryForApplication(@PathVariable Long applicationId) {
        return ResponseEntity.ok(securityReportService.getSummaryForApplication(applicationId));
    }

    @GetMapping("/dashboard/summary")
    public ResponseEntity<SecurityDashboardSummaryDto> getGlobalSummary(
            @RequestParam(required = false) Long clusterId) {
        if (clusterId != null) {
            return ResponseEntity.ok(securityReportService.getClusterSummary(clusterId));
        }
        return ResponseEntity.ok(securityReportService.getGlobalSummary());
    }

    @GetMapping("/dashboard/trends")
    public ResponseEntity<List<SecurityTrendPointDto>> getClusterTrends(
            @RequestParam(required = false) Long clusterId,
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(securityReportService.getClusterTrends(clusterId, days));
    }

    @GetMapping("/vulnerabilities")
    public ResponseEntity<Page<VulnerabilityDto>> getClusterVulnerabilities(
            @RequestParam(required = false) Long clusterId,
            @RequestParam(required = false) VulnerabilitySeverity severity,
            @RequestParam(required = false) VulnerabilityStatus status,
            @RequestParam(required = false) ReportType reportType,
            Pageable pageable) {
        return ResponseEntity.ok(securityReportService.getClusterVulnerabilities(clusterId, severity, status, reportType, pageable));
    }

    @GetMapping("/dashboard/trends/{applicationId}")
    public ResponseEntity<List<SecurityTrendPointDto>> getTrends(
            @PathVariable Long applicationId,
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(securityReportService.getTrends(applicationId, days));
    }

    @GetMapping("/dashboard/attack-surface")
    public ResponseEntity<AttackSurfaceDto> getAttackSurface(
            @RequestParam(required = false) Long environmentId,
            @RequestParam(required = false) Long clusterId) {
        if (clusterId != null) {
            return ResponseEntity.ok(securityReportService.getClusterAttackSurface(clusterId));
        }
        if (environmentId == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(securityReportService.getAttackSurface(environmentId));
    }
}
