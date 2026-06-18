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
public class DependencyCheckReportParser {

    private final ObjectMapper objectMapper;

    public DependencyCheckReportParser(ObjectMapper objectMapper) {
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
            JsonNode dependenciesNode = rootNode.path("dependencies");

            if (dependenciesNode.isArray()) {
                for (JsonNode dependencyNode : dependenciesNode) {
                    JsonNode vulnsNode = dependencyNode.path("vulnerabilities");
                    String filePath = dependencyNode.path("filePath").asText(null);

                    if (vulnsNode.isArray()) {
                        for (JsonNode vulnNode : vulnsNode) {
                            try {
                                String identifier = vulnNode.path("name").asText("Unknown");
                                String severityStr = vulnNode.path("severity").asText("INFO").toUpperCase();
                                String description = vulnNode.path("description").asText("");
                                
                                double cvssScore = 0.0;
                                JsonNode cvssv3 = vulnNode.path("cvssv3");
                                if (!cvssv3.isMissingNode() && cvssv3.has("baseScore")) {
                                    cvssScore = cvssv3.path("baseScore").asDouble();
                                } else {
                                    JsonNode cvssv2 = vulnNode.path("cvssv2");
                                    if (!cvssv2.isMissingNode() && cvssv2.has("score")) {
                                        cvssScore = cvssv2.path("score").asDouble();
                                    }
                                }

                                VulnerabilitySeverity severity = mapSeverity(severityStr);

                                SecurityVulnerability vuln = SecurityVulnerability.builder()
                                        .report(report)
                                        .identifier(identifier)
                                        .title("Dependency Vulnerability: " + identifier)
                                        .severity(severity)
                                        .description(description)
                                        .filePath(filePath)
                                        .cvssScore(cvssScore > 0 ? cvssScore : null)
                                        .build();

                                vulnerabilities.add(vuln);

                                switch (severity) {
                                    case CRITICAL -> criticalCount++;
                                    case HIGH -> highCount++;
                                    case MEDIUM -> mediumCount++;
                                    case LOW, INFO -> lowCount++;
                                }
                            } catch (Exception e) {
                                log.warn("Skipping malformed vulnerability in Dependency-Check report: {}", e.getMessage());
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to parse Dependency-Check JSON report: {}", e.getMessage());
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
            case "CRITICAL" -> VulnerabilitySeverity.CRITICAL;
            case "HIGH" -> VulnerabilitySeverity.HIGH;
            case "MEDIUM" -> VulnerabilitySeverity.MEDIUM;
            case "LOW" -> VulnerabilitySeverity.LOW;
            default -> VulnerabilitySeverity.INFO;
        };
    }
}
