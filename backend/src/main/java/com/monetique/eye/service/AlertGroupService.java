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
    private final com.monetique.eye.repository.ManagedNodeRepository managedNodeRepository;

    @Transactional
    public void ingestAlert(Map<String, String> labels, Map<String, String> annotations, String status,
            String fingerprint) {
        String severity = labels.getOrDefault("severity", "warning");
        log.info("=== ALERT INGESTION === status='{}', fingerprint='{}', labels={}", status, fingerprint, labels);

        AlertGroup group = correlationEngine.correlate(labels, severity);
        log.info("Correlated to group: id={}, name='{}', hasTicket={}", group.getId(), group.getName(),
                group.getTicket() != null);

        Alert alert = Alert.builder()
                .group(group)
                .prometheusFingerprint(fingerprint)
                .labels(labels)
                .annotations(annotations)
                .status(status)
                .firedAt(LocalDateTime.now())
                .build();

        alertRepository.save(alert);

        // Auto-raise ticket if needed — use case-insensitive check since Alertmanager
        // sends "firing"
        boolean isFiring = "firing".equalsIgnoreCase(status);
        boolean needsTicket = group.getTicket() == null;
        log.info("Ticket check: isFiring={}, needsTicket={}", isFiring, needsTicket);

        if (needsTicket && isFiring) {
            String alertName = labels.getOrDefault("alertname", "unknown");

            // 1. Resolve Environment (Mandatory for Ticket)
            // Strategy: Node DB Lookup > IP DB Lookup > Label 'environment' > Label 'env'
            com.monetique.eye.entity.Environment env = null;

            // Attempt A: Node Name Lookup
            String nodeLabel = labels.getOrDefault("nodename", labels.get("node"));
            if (nodeLabel != null) {
                env = managedNodeRepository.findByNodeName(nodeLabel)
                        .map(com.monetique.eye.entity.ManagedNode::getEnvironment)
                        .orElse(null);
            }

            // Attempt B: IP Lookup
            if (env == null) {
                String instance = labels.get("instance");
                if (instance != null) {
                    String ip = instance.contains(":") ? instance.substring(0, instance.indexOf(":")) : instance;
                    env = managedNodeRepository.findByIp(ip)
                            .map(com.monetique.eye.entity.ManagedNode::getEnvironment)
                            .orElse(null);
                }
            }

            // Attempt C: Labels
            if (env == null) {
                String envName = labels.getOrDefault("environment", 
                                 labels.getOrDefault("env", 
                                 labels.getOrDefault("container_label_env",
                                 labels.getOrDefault("container_label_com_monetique_environment", "unknown"))));
                env = environmentRepository.findByPrometheusLabel(envName)
                        .orElseGet(() -> environmentRepository.findByName(envName).orElse(null));
            }

            // Fallback: Pick first environment if still not found
            if (env == null) {
                log.warn("Environment could not be resolved from node/IP or labels, falling back to first available");
                env = environmentRepository.findAll().stream().findFirst().orElse(null);
            }

            if (env != null) {
                // 2. Resolve Application (Optional for Ticket)
                String appName = labels.getOrDefault("application", labels.getOrDefault("service_name", "unknown"));
                com.monetique.eye.entity.Application app = applicationRepository.findByName(appName).orElse(null);

                log.info("AUTO-RAISING TICKET for alert '{}' on env '{}' (App: {})", alertName, env.getName(),
                        app != null ? app.getName() : "None");

                com.monetique.eye.entity.Ticket ticket = com.monetique.eye.entity.Ticket.builder()
                        .title("[ALERT] " + group.getName())
                        .description(
                                "Automated ticket raised from Prometheus alert: " + alertName + "\nLabels: " + labels)
                        .status(com.monetique.eye.entity.enums.TicketStatus.OPEN)
                        .priority("critical".equalsIgnoreCase(severity) ? "CRITICAL" : "HIGH")
                        .application(app)
                        .environment(env)
                        .node(labels.getOrDefault("nodename", labels.getOrDefault("instance", labels.get("node"))))
                        .build();

                com.monetique.eye.entity.Ticket savedTicket = ticketRepository.save(ticket);
                group.setTicket(savedTicket);
                log.info("TICKET CREATED: id={}, title='{}'", savedTicket.getId(), savedTicket.getTitle());
            } else {
                log.error("Cannot raise ticket: No environment found for labels '{}' and no default environment exists.",
                        labels);
            }
        } else if (isFiring && group.getTicket() != null) {
            // Update existing ticket if new alert joins the same group (e.g. FrontendDown
            // joining Monetique App Down)
            String alertName = labels.getOrDefault("alertname", "unknown");
            com.monetique.eye.entity.Ticket ticket = group.getTicket();

            String appName = labels.getOrDefault("application", labels.getOrDefault("service_name", "unknown"));
            boolean needsSave = false;

            // Check if this alert belongs to a different app than the current ticket tag
            com.monetique.eye.entity.Application currentApp = ticket.getApplication();
            if (currentApp != null && !currentApp.getName().equalsIgnoreCase(appName)) {
                // Outage spans multiple applications. We keep the primary app tag, but we
                // update the TITLE to show both!
                String newTag = appName.toLowerCase();
                if (!ticket.getTitle().toLowerCase().contains(newTag)) {
                    // E.g. changes "[ALERT] Monetique App Down" to "[ALERT] Monetique App Down
                    // (backend, frontend)"
                    if (ticket.getTitle().endsWith(")")) {
                        ticket.setTitle(
                                ticket.getTitle().substring(0, ticket.getTitle().length() - 1) + ", " + newTag + ")");
                    } else {
                        ticket.setTitle(
                                ticket.getTitle() + " (" + currentApp.getName().toLowerCase() + ", " + newTag + ")");
                    }
                    needsSave = true;
                }
            }

            // Append the new alert info to the description if it's not already there
            if (!ticket.getDescription().contains(alertName)) {
                ticket.setDescription(
                        ticket.getDescription() + "\n\nAdditional Alert: " + alertName + "\nLabels: " + labels);
                needsSave = true;
            }

            if (needsSave) {
                ticketRepository.save(ticket);
                log.info("TICKET UPDATED: id={}, appended alert '{}' and updated title to '{}'", ticket.getId(),
                        alertName, ticket.getTitle());
            }
        }

        groupRepository.save(group);
    }

    @Transactional
    public void resolveGroup(String fingerprint) {
        groupRepository.findByFingerprint(fingerprint).ifPresent(group -> {
            group.setStatus(AlertGroupStatus.RESOLVED);
            group.setResolvedAt(LocalDateTime.now());

            if (group.getTicket() != null) {
                com.monetique.eye.entity.Ticket ticket = group.getTicket();
                ticket.setStatus(com.monetique.eye.entity.enums.TicketStatus.RESOLVED);
                ticketRepository.save(ticket);
                log.info("TICKET RESOLVED: id={}, title='{}'", ticket.getId(), ticket.getTitle());
            }

            groupRepository.save(group);
        });
    }

    public List<AlertGroup> getActiveGroups() {
        return groupRepository.findByStatus(AlertGroupStatus.FIRING);
    }

}
