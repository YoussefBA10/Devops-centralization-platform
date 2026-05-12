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
        log.info("Received alert webhook from Alertmanager");
        
        String status = payload.path("status").asText();
        JsonNode alerts = payload.path("alerts");
        
        if (alerts.isArray()) {
            for (JsonNode alertNode : alerts) {
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
                
                if ("resolved".equalsIgnoreCase(alertStatus)) {
                    // Logic to resolve group might need more than just fingerprint if multiple groups exist,
                    // but the spec says CorrelationEngine deduplicates by fingerprint.
                    alertGroupService.resolveGroup(fingerprint);
                } else {
                    alertGroupService.ingestAlert(labels, annotations, alertStatus, fingerprint);
                }
            }
        }
        
        return ResponseEntity.ok().build();
    }
}
