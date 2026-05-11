package com.monetique.eye.controller;

import com.monetique.eye.dto.LogResponseDTO;
import com.monetique.eye.service.LogService;
import com.monetique.eye.service.SecurityService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

import com.monetique.eye.security.RequiresPermission;

@RestController
@RequestMapping("/api/apps/{appId}/logs")
@RequiresPermission("MONITORING_LOGS")
public class LogController {

    private final LogService logService;
    private final SecurityService securityService;

    public LogController(LogService logService, SecurityService securityService) {
        this.logService = logService;
        this.securityService = securityService;
    }

    /**
     * Search application logs in Elasticsearch.
     * Enforces Multi-Tenant access checks implicitly using SecurityService.
     */
    @GetMapping("/search")
    public ResponseEntity<?> searchLogs(
            @PathVariable Long appId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(defaultValue = "0") int page) {
        
        if (!securityService.canAccessApplication(appId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access Denied: You do not have permission to view logs for this application.");
        }

        // Cap maximum page size to prevent abuse
        int resolvedSize = Math.min(size, 200);
        Pageable pageable = PageRequest.of(page, resolvedSize);

        LogResponseDTO response = logService.searchLogs(appId, q, severity, from, to, pageable);
        return ResponseEntity.ok(response);
    }

    /**
     * Export application logs as CSV.
     */
    @GetMapping("/export")
    public ResponseEntity<?> exportLogs(
            @PathVariable Long appId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        
        if (!securityService.canAccessApplication(appId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access Denied.");
        }

        String csvData = logService.exportLogsAsCsv(appId, q, severity, from, to);
        byte[] bytes = csvData.getBytes();
        org.springframework.core.io.ByteArrayResource resource = new org.springframework.core.io.ByteArrayResource(bytes);

        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=logs_export_" + appId + ".csv")
                .contentType(org.springframework.http.MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .contentLength(bytes.length)
                .body(resource);
    }

    /**
     * Delete log buffers. Strictly locked behind admin access in addition to application scoping.
     */
    @PostMapping("/clear")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<?> clearLogs(@PathVariable Long appId) {
        if (!securityService.canAccessApplication(appId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access Denied.");
        }
        logService.clearBuffer(appId);
        return ResponseEntity.ok("Log buffer cleared successfully.");
    }
}
