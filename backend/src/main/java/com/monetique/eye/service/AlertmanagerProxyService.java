package com.monetique.eye.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AlertmanagerProxyService {

    private final RestTemplate restTemplate;

    @Value("${monitoring.alertmanager.base-url:http://localhost:9093}")
    private String alertmanagerBaseUrl;

    public JsonNode getActiveAlerts() {
        try {
            String url = alertmanagerBaseUrl + "/api/v2/alerts?filter=job=~\"blackbox_probe|node_exporter|cadvisor|app_metrics.*\"";
            ResponseEntity<JsonNode> response = restTemplate.getForEntity(url, JsonNode.class);
            return response.getBody();
        } catch (Exception e) {
            log.error("Failed to fetch active alerts from Alertmanager: {}", e.getMessage());
            return null;
        }
    }

    public void silenceAlert(String alertId) {
        try {
            // In Alertmanager API v2, silences are created by POSTing to /api/v2/silences
            // We need to create a silence matcher based on the alertId (which might be an alert fingerprint or just a label set)
            // For simplicity, let's assume alertId here is the alert fingerprint or a specific label.
            // Usually, silencing is done by matching labels. If we want to silence a specific alert, we match its key labels.
            // But if the spec meant a generic silence ID, we'll just create a 1h silence for the given alert name or ID.
            
            // To properly silence an alert, we need its labels. 
            // If the frontend sends the labels in the request body, we should accept them. 
            // The spec says: POST /api/network/alerts/{id}/silence, duration: 1h default.
            // We will just do a basic implementation assuming alertId maps to alertname for this example.
            
            String url = alertmanagerBaseUrl + "/api/v2/silences";
            
            Map<String, Object> silence = new HashMap<>();
            
            // Default 1 hour silence
            long now = System.currentTimeMillis();
            long end = now + (3600 * 1000);
            
            silence.put("startsAt", new java.util.Date(now).toInstant().toString());
            silence.put("endsAt", new java.util.Date(end).toInstant().toString());
            silence.put("comment", "Silenced from Monetique Eye Network Monitor");
            silence.put("createdBy", "MonetiqueEye");
            
            // For now, match by alertname = alertId (this might need refinement if alertId is not alertname)
            Map<String, Object> matcher = new HashMap<>();
            matcher.put("name", "alertname");
            matcher.put("value", alertId);
            matcher.put("isRegex", false);
            matcher.put("isEqual", true);
            
            silence.put("matchers", java.util.Collections.singletonList(matcher));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(silence, headers);

            restTemplate.postForEntity(url, request, String.class);
            log.info("Silenced alert {} for 1h", alertId);
        } catch (Exception e) {
            log.error("Failed to silence alert in Alertmanager: {}", e.getMessage());
            throw new RuntimeException("Failed to silence alert", e);
        }
    }
}
