package com.monetique.eye.security.service.parser;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.monetique.eye.security.entity.SecurityScanReport;
import com.monetique.eye.security.entity.SecurityVulnerability;
import com.monetique.eye.security.entity.enums.VulnerabilitySeverity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DependencyCheckReportParserTest {

    private DependencyCheckReportParser parser;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        parser = new DependencyCheckReportParser(objectMapper);
    }

    @Test
    void testParseValidJson() {
        String json = """
        {
            "dependencies": [
                {
                    "filePath": "/some/path/lib.jar",
                    "vulnerabilities": [
                        {
                            "name": "CVE-2023-1234",
                            "severity": "HIGH",
                            "description": "Test vulnerability",
                            "cvssv3": {
                                "baseScore": 7.5
                            }
                        }
                    ]
                }
            ]
        }
        """;

        SecurityScanReport report = new SecurityScanReport();
        List<SecurityVulnerability> vulns = parser.parse(report, json);

        assertEquals(1, vulns.size());
        SecurityVulnerability vuln = vulns.get(0);
        assertEquals("CVE-2023-1234", vuln.getIdentifier());
        assertEquals(VulnerabilitySeverity.HIGH, vuln.getSeverity());
        assertEquals("Test vulnerability", vuln.getDescription());
        assertEquals("/some/path/lib.jar", vuln.getFilePath());
        assertEquals(7.5, vuln.getCvssScore());

        assertEquals(1, report.getTotalIssues());
        assertEquals(1, report.getHighCount());
        assertEquals(0, report.getCriticalCount());
    }

    @Test
    void testParseMalformedJson() {
        String json = "{\"dependencies\": [{\"vulnerabilities\": [{\"name\": \"CVE-Missing-Severity\"}]}]}";
        SecurityScanReport report = new SecurityScanReport();
        List<SecurityVulnerability> vulns = parser.parse(report, json);

        assertEquals(1, vulns.size());
        assertEquals(VulnerabilitySeverity.INFO, vulns.get(0).getSeverity());
    }
}
