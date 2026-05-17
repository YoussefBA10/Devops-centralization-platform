package com.monetique.eye.service;

import com.monetique.eye.entity.Alert;
import com.monetique.eye.entity.AlertGroup;
import com.monetique.eye.entity.enums.AlertGroupStatus;
import com.monetique.eye.repository.AlertGroupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CorrelationEngine {

    private final AlertGroupRepository alertGroupRepository;

    public AlertGroup correlate(Map<String, String> labels, String severity, String envName) {
        String serviceName = labels.get("service_name");
        if (serviceName == null) {
            serviceName = labels.getOrDefault("application", labels.getOrDefault("job", "unknown"));
        }
        String alertName = labels.getOrDefault("alertname", "unknown");

        // Rule 1: Fingerprinting for deduplication
        String fingerprint = generateFingerprint(serviceName, alertName, severity, envName);
        String groupName = alertName + " on " + serviceName;
        String groupingFingerprint = fingerprint;

        // Smart Grouping: Combine BackendDown and FrontendDown into "Monetique App Down"
        if (alertName.contains("Down") && (alertName.contains("Backend") || alertName.contains("Frontend"))) {
            groupName = "Monetique App Down";
            groupingFingerprint = generateFingerprint("monetique-app", "app-down", severity, envName);
        }

        Optional<AlertGroup> existingGroup = alertGroupRepository.findByFingerprint(groupingFingerprint);

        AlertGroup group;
        if (existingGroup.isPresent()) {
            group = existingGroup.get();
            group.setLastFiredAt(LocalDateTime.now());

            // If it was resolved, but is now firing again
            if (group.getStatus() != AlertGroupStatus.FIRING) {
                group.setStatus(AlertGroupStatus.FIRING);
                group.setFirstFiredAt(LocalDateTime.now());
                group.setResolvedAt(null);
                // Clear the old ticket so a new one is raised for this new occurrence
                group.setTicket(null);
            }
        } else {
            group = AlertGroup.builder()
                    .fingerprint(groupingFingerprint)
                    .name(groupName)
                    .severity(severity)
                    .status(AlertGroupStatus.FIRING)
                    .firstFiredAt(LocalDateTime.now())
                    .lastFiredAt(LocalDateTime.now())
                    .build();
        }

        // Rule 2: Infrastructure tagging
        if (isInfrastructureIssue(labels)) {
            group.setName("[INFRA] " + group.getName());
        }

        // Rule 3: Security tagging
        if (isSecurityIssue(labels)) {
            group.setName("[SECURITY] " + group.getName());
        }

        return alertGroupRepository.save(group);
    }

    private String generateFingerprint(String service, String alert, String severity, String envName) {
        try {
            String raw = service + "|" + alert + "|" + severity + "|" + envName;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private boolean isInfrastructureIssue(Map<String, String> labels) {
        String alertName = labels.getOrDefault("alertname", "").toLowerCase();
        boolean isSpike = alertName.contains("cpu") || alertName.contains("memory");
        boolean isRestart = alertName.contains("restart") || alertName.contains("loop");
        return isSpike && isRestart;
    }

    private boolean isSecurityIssue(Map<String, String> labels) {
        // Simple heuristic: >5 alerts from same IP would be handled by counting in a
        // window,
        // but the rule says "if labels contain...".
        // We'll simplify to checking if it's a security-related alert name for now or
        // has source_ip.
        return labels.containsKey("source_ip") && labels.getOrDefault("alertname", "").toLowerCase().contains("attack");
    }
}
