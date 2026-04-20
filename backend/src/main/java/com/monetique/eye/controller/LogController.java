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

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/apps/{appId}/logs")
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
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(defaultValue = "0") int page) {
        
        if (!securityService.canAccessApplication(appId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access Denied: You do not have permission to view logs for this application.");
        }

        // Cap maximum page size to prevent abuse
        int resolvedSize = Math.min(size, 200);
        Pageable pageable = PageRequest.of(page, resolvedSize);

        LogResponseDTO response = logService.searchLogs(appId, q, from, to, pageable);
        return ResponseEntity.ok(response);
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
