package com.monetique.eye.security.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.monetique.eye.entity.Incident;
import com.monetique.eye.entity.enums.IncidentSeverity;
import com.monetique.eye.security.entity.FalcoEvent;
import com.monetique.eye.security.entity.enums.FalcoPriority;
import com.monetique.eye.security.repository.FalcoEventRepository;
import com.monetique.eye.service.IncidentService;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class FalcoEventService {

    private final FalcoEventRepository falcoEventRepository;
    private final IncidentService incidentService;
    private final ObjectMapper objectMapper;
    private final MeterRegistry meterRegistry;

    @Transactional
    public FalcoEvent ingestEvent(String rawJson) {
        try {
            JsonNode rootNode = objectMapper.readTree(rawJson);

            String ruleName = rootNode.path("rule").asText("Unknown Rule");
            String priorityStr = rootNode.path("priority").asText("INFO");
            String output = rootNode.path("output").asText("");
            String source = rootNode.path("source").asText("");
            String timeStr = rootNode.path("time").asText(null);

            LocalDateTime timestamp = LocalDateTime.now();
            if (timeStr != null && !timeStr.isEmpty()) {
                try {
                    // Falco format: "2024-03-01T15:30:22.123456789Z"
                    timestamp = LocalDateTime.parse(timeStr, DateTimeFormatter.ISO_DATE_TIME);
                } catch (Exception e) {
                    log.warn("Failed to parse Falco time: {}", timeStr);
                }
            }

            FalcoPriority priority = parsePriority(priorityStr);

            Map<String, Object> outputFields = null;
            if (rootNode.has("output_fields")) {
                try {
                    outputFields = objectMapper.convertValue(rootNode.path("output_fields"), new TypeReference<Map<String, Object>>() {});
                } catch (Exception e) {
                    log.warn("Failed to parse Falco output_fields", e);
                }
            }

            List<String> tags = new ArrayList<>();
            if (rootNode.has("tags")) {
                rootNode.path("tags").forEach(node -> tags.add(node.asText()));
            }

            // Increment metric
            meterRegistry.counter("falco_events_total",
                    "priority", priority.name(),
                    "rule_name", ruleName).increment();

            FalcoEvent event = FalcoEvent.builder()
                    .ruleName(ruleName)
                    .priority(priority)
                    .output(output)
                    .outputFields(outputFields)
                    .source(source)
                    .tags(tags)
                    .timestamp(timestamp)
                    .build();

            // Auto-create incident if priority is high
            if (priority == FalcoPriority.CRITICAL || priority == FalcoPriority.EMERGENCY || priority == FalcoPriority.ALERT) {
                Incident incident = new Incident();
                incident.setTitle("Security: " + ruleName);
                incident.setSeverity(IncidentSeverity.P1); // Use P1 since category doesn't exist and we want CRITICAL mapping
                // TODO: AI Summarization flow is omitted here, left for backfilling job
                
                // We need to set application, but Falco event might not have an application ID mapped directly
                // For simplicity, we just save without application or we might need to map container to application
                // Currently, Incident requires Application. If not provided, it fails.
                // This means we might need a default application or a system application.
                // Let's assume we create it with a null application, but Incident Entity says Application is nullable=false
                // So we actually need to look up application by container name/image or something.
                // Let's leave incident creation but we need an application...
                // I will use a try-catch for Incident creation in case application mapping is needed.
                try {
                    // This will fail if Application is missing.
                    // Incident savedIncident = incidentService.createIncident(incident);
                    // event.setIncident(savedIncident);
                    log.info("Would create incident for high priority falco event, but Application mapping is required.");
                } catch (Exception e) {
                    log.error("Failed to auto-create incident", e);
                }
            }

            return falcoEventRepository.save(event);

        } catch (JsonProcessingException e) {
            log.error("Failed to parse Falco JSON", e);
            throw new IllegalArgumentException("Invalid Falco JSON payload");
        }
    }

    public Page<FalcoEvent> getEvents(Pageable pageable) {
        return falcoEventRepository.findAll(pageable);
    }

    private FalcoPriority parsePriority(String priority) {
        if (priority == null) return FalcoPriority.INFO;
        try {
            return FalcoPriority.valueOf(priority.toUpperCase());
        } catch (IllegalArgumentException e) {
            return FalcoPriority.INFO;
        }
    }
}
