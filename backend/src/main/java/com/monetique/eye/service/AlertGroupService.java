package com.monetique.eye.service;

import com.monetique.eye.entity.Alert;
import com.monetique.eye.entity.AlertGroup;
import com.monetique.eye.entity.enums.AlertGroupStatus;
import com.monetique.eye.repository.AlertGroupRepository;
import com.monetique.eye.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AlertGroupService {

    private final AlertGroupRepository groupRepository;
    private final AlertRepository alertRepository;
    private final CorrelationEngine correlationEngine;
    private final com.monetique.eye.repository.TicketRepository ticketRepository;
    private final com.monetique.eye.repository.ApplicationRepository applicationRepository;

    @Transactional
    public void ingestAlert(Map<String, String> labels, Map<String, String> annotations, String status, String fingerprint) {
        String severity = labels.getOrDefault("severity", "warning");
        AlertGroup group = correlationEngine.correlate(labels, severity);
        
        Alert alert = Alert.builder()
                .group(group)
                .prometheusFingerprint(fingerprint)
                .labels(labels)
                .annotations(annotations)
                .status(status)
                .firedAt(LocalDateTime.now())
                .build();
        
        alertRepository.save(alert);

        // Auto-raise ticket if needed
        if (group.getTicket() == null && "FIRING".equals(status)) {
            String alertName = labels.getOrDefault("alertname", "unknown");
            String serviceName = labels.get("service_name");
            if (serviceName == null) {
                serviceName = labels.getOrDefault("application", "unknown");
            }
            
            // Inference logic: if still unknown, try to guess from alertName
            if ("unknown".equals(serviceName)) {
                if (alertName.contains("Backend")) serviceName = "backend";
                else if (alertName.contains("Frontend")) serviceName = "frontend";
            }
            
            log.info("Auto-raising ticket for alert '{}' on service '{}'", alertName, serviceName);
            
            com.monetique.eye.entity.Application app = applicationRepository.findByName(serviceName).orElse(null);
            if (app != null) {
                com.monetique.eye.entity.Ticket ticket = com.monetique.eye.entity.Ticket.builder()
                        .title("[ALERT] " + group.getName())
                        .description("Automated ticket raised from Prometheus alert: " + alertName + "\nLabels: " + labels)
                        .status(com.monetique.eye.entity.enums.TicketStatus.OPEN)
                        .priority("critical".equalsIgnoreCase(severity) ? "CRITICAL" : "HIGH")
                        .application(app)
                        .environment(app.getEnvironment())
                        .build();
                
                com.monetique.eye.entity.Ticket savedTicket = ticketRepository.save(ticket);
                group.setTicket(savedTicket);
            }
        }
        
        groupRepository.save(group);
    }

    @Transactional
    public void resolveGroup(String fingerprint) {
        groupRepository.findByFingerprint(fingerprint).ifPresent(group -> {
            group.setStatus(AlertGroupStatus.RESOLVED);
            group.setResolvedAt(LocalDateTime.now());
            groupRepository.save(group);
        });
    }

    public List<AlertGroup> getActiveGroups() {
        return groupRepository.findByStatus(AlertGroupStatus.FIRING);
    }

}
