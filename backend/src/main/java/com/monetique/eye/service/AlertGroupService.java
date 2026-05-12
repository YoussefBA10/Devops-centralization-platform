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
    private final com.monetique.eye.repository.EnvironmentRepository environmentRepository;

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
            
            // 1. Resolve Environment (Mandatory for Ticket)
            String envName = labels.getOrDefault("environment", labels.getOrDefault("env", "unknown"));
            com.monetique.eye.entity.Environment env = environmentRepository.findByName(envName)
                    .orElseGet(() -> environmentRepository.findAll().stream().findFirst().orElse(null));

            if (env != null) {
                // 2. Resolve Application (Optional for Ticket)
                String appName = labels.getOrDefault("application", labels.getOrDefault("service_name", "unknown"));
                com.monetique.eye.entity.Application app = applicationRepository.findByName(appName).orElse(null);

                log.info("Auto-raising ticket for alert '{}' on env '{}' (App: {})", alertName, env.getName(), app != null ? app.getName() : "None");
                
                com.monetique.eye.entity.Ticket ticket = com.monetique.eye.entity.Ticket.builder()
                        .title("[ALERT] " + group.getName())
                        .description("Automated ticket raised from Prometheus alert: " + alertName + "\nLabels: " + labels)
                        .status(com.monetique.eye.entity.enums.TicketStatus.OPEN)
                        .priority("critical".equalsIgnoreCase(severity) ? "CRITICAL" : "HIGH")
                        .application(app)
                        .environment(env)
                        .node(labels.get("nodename"))
                        .build();
                
                com.monetique.eye.entity.Ticket savedTicket = ticketRepository.save(ticket);
                group.setTicket(savedTicket);
            } else {
                log.error("Cannot raise ticket: No environment found for label '{}' and no default environment exists.", envName);
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
