package com.monetique.eye.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.monetique.eye.service.AlertGroupService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
@Slf4j
public class AlertIngestionController {

    private final AlertGroupService alertGroupService;

    @PostMapping("/ingest")
    public ResponseEntity<?> ingest(@RequestBody JsonNode payload) {
        log.info("Received alert webhook from Alertmanager: {}", payload.toString());
        
        String status = payload.path("status").asText();
        JsonNode alerts = payload.path("alerts");
        
        if (alerts.isArray()) {
            for (JsonNode alertNode : alerts) {
                try {
                    Map<String, String> labels = new HashMap<>();
                    alertNode.path("labels").fields().forEachRemaining(entry -> 
                        labels.put(entry.getKey(), entry.getValue().asText())
                    );
                    
                    Map<String, String> annotations = new HashMap<>();
                    alertNode.path("annotations").fields().forEachRemaining(entry -> 
                        annotations.put(entry.getKey(), entry.getValue().asText())
                    );
                    
                    String alertStatus = alertNode.path("status").asText();
                    String fingerprint = alertNode.path("fingerprint").asText();
                    
                    log.info("Processing alert: status='{}', fingerprint='{}', labels={}", alertStatus, fingerprint, labels);
                    
                    if ("resolved".equalsIgnoreCase(alertStatus)) {
                        alertGroupService.resolveGroup(fingerprint);
                    } else {
                        alertGroupService.ingestAlert(labels, annotations, alertStatus, fingerprint);
                    }
                } catch (Exception e) {
                    log.error("Failed to process alert: {}", alertNode, e);
                }
            }
        }
        
        return ResponseEntity.ok().build();
    }

    /**
     * Test endpoint to verify ticket creation pipeline.
     * Call: GET /api/alerts/test-ticket
     */
    @org.springframework.web.bind.annotation.GetMapping("/test-ticket")
    public ResponseEntity<?> testTicket() {
        log.info("=== TEST TICKET CREATION ===");
        Map<String, String> labels = new HashMap<>();
        labels.put("alertname", "BackendDown");
        labels.put("severity", "critical");
        labels.put("application", "backend");
        labels.put("environment", "central-node");
        labels.put("job", "monetique-backend");
        labels.put("instance", "backend:8880");

        Map<String, String> annotations = new HashMap<>();
        annotations.put("summary", "TEST: Backend is down");
        annotations.put("description", "This is a test alert to verify ticket creation.");

        try {
            alertGroupService.ingestAlert(labels, annotations, "firing", "test-fingerprint-" + System.currentTimeMillis());
            return ResponseEntity.ok(Map.of("status", "success", "message", "Test alert processed. Check /tickets for a new ticket."));
        } catch (Exception e) {
            log.error("Test ticket creation failed", e);
            return ResponseEntity.status(500).body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
}
