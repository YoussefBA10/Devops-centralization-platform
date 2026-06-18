package com.monetique.eye.security.service.parser;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.monetique.eye.security.entity.SecurityScanReport;
import com.monetique.eye.security.entity.SecurityVulnerability;
import com.monetique.eye.security.entity.enums.VulnerabilitySeverity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
public class SonarReportParser {

    private final ObjectMapper objectMapper;

    public SonarReportParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public List<SecurityVulnerability> parse(SecurityScanReport report, String rawJson) {
        List<SecurityVulnerability> vulnerabilities = new ArrayList<>();
        int criticalCount = 0;
        int highCount = 0;
        int mediumCount = 0;
        int lowCount = 0;

        try {
            JsonNode rootNode = objectMapper.readTree(rawJson);
            JsonNode issuesNode = rootNode.path("issues");

            if (issuesNode.isArray()) {
                for (JsonNode issueNode : issuesNode) {
                    try {
                        String identifier = issueNode.path("rule").asText("Unknown");
                        String severityStr = issueNode.path("severity").asText("INFO").toUpperCase();
                        String message = issueNode.path("message").asText("");
                        String component = issueNode.path("component").asText(null);

                        VulnerabilitySeverity severity = mapSeverity(severityStr);

                        SecurityVulnerability vuln = SecurityVulnerability.builder()
                                .report(report)
                                .identifier(identifier)
                                .title("SonarQube Issue: " + identifier)
                                .severity(severity)
                                .description(message)
                                .filePath(component)
                                .build();

                        vulnerabilities.add(vuln);

                        switch (severity) {
                            case CRITICAL -> criticalCount++;
                            case HIGH -> highCount++;
                            case MEDIUM -> mediumCount++;
                            case LOW, INFO -> lowCount++;
                        }
                    } catch (Exception e) {
                        log.warn("Skipping malformed issue in SonarQube report: {}", e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to parse SonarQube JSON report: {}", e.getMessage());
        }

        report.setCriticalCount(criticalCount);
        report.setHighCount(highCount);
        report.setMediumCount(mediumCount);
        report.setLowCount(lowCount);
        report.setTotalIssues(vulnerabilities.size());
        
        return vulnerabilities;
    }

    private VulnerabilitySeverity mapSeverity(String severity) {
        if (severity == null) return VulnerabilitySeverity.INFO;
        return switch (severity) {
            case "BLOCKER", "CRITICAL" -> VulnerabilitySeverity.CRITICAL;
            case "MAJOR" -> VulnerabilitySeverity.HIGH;
            case "MINOR" -> VulnerabilitySeverity.MEDIUM;
            case "INFO" -> VulnerabilitySeverity.LOW;
            default -> VulnerabilitySeverity.INFO;
        };
    }
}
