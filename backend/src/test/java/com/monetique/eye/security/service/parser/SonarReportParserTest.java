package com.monetique.eye.security.service.parser;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.monetique.eye.security.entity.SecurityScanReport;
import com.monetique.eye.security.entity.SecurityVulnerability;
import com.monetique.eye.security.entity.enums.VulnerabilitySeverity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SonarReportParserTest {

    private SonarReportParser parser;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        parser = new SonarReportParser(objectMapper);
    }

    @Test
    void testParseValidJson() {
        String json = """
        {
            "issues": [
                {
                    "rule": "java:S106",
                    "severity": "BLOCKER",
                    "message": "Use logger instead of System.out",
                    "component": "src/main/java/Main.java"
                }
            ]
        }
        """;

        SecurityScanReport report = new SecurityScanReport();
        List<SecurityVulnerability> vulns = parser.parse(report, json);

        assertEquals(1, vulns.size());
        SecurityVulnerability vuln = vulns.get(0);
        assertEquals("java:S106", vuln.getIdentifier());
        assertEquals(VulnerabilitySeverity.CRITICAL, vuln.getSeverity()); // BLOCKER -> CRITICAL
        assertEquals("Use logger instead of System.out", vuln.getDescription());
        assertEquals("src/main/java/Main.java", vuln.getFilePath());

        assertEquals(1, report.getTotalIssues());
        assertEquals(1, report.getCriticalCount());
    }
}
