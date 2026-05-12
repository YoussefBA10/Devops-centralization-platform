package com.monetique.eye.service;

import com.monetique.eye.entity.AlertGroup;
import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.Incident;
import com.monetique.eye.entity.enums.IncidentSeverity;
import com.monetique.eye.entity.enums.IncidentStatus;
import com.monetique.eye.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

@Service
@RequiredArgsConstructor
public class IncidentAutoCreator {

    private final IncidentService incidentService;
    private final ApplicationRepository applicationRepository;

    private static final Set<String> AUTO_CREATE_ALERTS = Set.of(
            "ContainerOOMKilled", "BackendDown", "FrontendDown", "HighErrorRate"
    );

    @Transactional
    public void processGroup(AlertGroup group, String alertName, String serviceName) {
        if (group.getIncident() != null) return; // Already has an incident

        if (AUTO_CREATE_ALERTS.contains(alertName)) {
            IncidentSeverity severity = "critical".equalsIgnoreCase(group.getSeverity()) 
                    ? IncidentSeverity.P1 : IncidentSeverity.P2;
            
            Application app = applicationRepository.findByName(serviceName).orElse(null);
            if (app == null) return; // Cannot create incident without application

            Incident incident = Incident.builder()
                    .title("Auto-Incident: " + group.getName())
                    .application(app)
                    .severity(severity)
                    .status(IncidentStatus.INVESTIGATING)
                    .aiSummary("Automatically created from critical alert: " + alertName)
                    .build();

            Incident saved = incidentService.createIncident(incident);
            group.setIncident(saved);
            // The AlertGroupService will save the group later or we can save it here
        }
    }
}
