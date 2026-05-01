package com.monetique.eye.controller;

import com.monetique.eye.entity.AiOperationalSummary;
import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.LogAggregationWindow;
import com.monetique.eye.repository.AiOperationalSummaryRepository;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.LogAggregationWindowRepository;
import com.monetique.eye.security.RequiresPermission;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.monetique.eye.service.InfrastructureService;
import com.monetique.eye.service.AnomalyService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/operational")
@RequiresPermission("MONITORING_OBSERVABILITY")
public class OperationalController {

    private final LogAggregationWindowRepository aggregationRepository;
    private final AiOperationalSummaryRepository summaryRepository;
    private final ApplicationRepository applicationRepository;
    private final InfrastructureService infrastructureService;
    private final AnomalyService anomalyService;

    public OperationalController(LogAggregationWindowRepository aggregationRepository,
                                 AiOperationalSummaryRepository summaryRepository,
                                 ApplicationRepository applicationRepository,
                                 InfrastructureService infrastructureService,
                                 AnomalyService anomalyService) {
        this.aggregationRepository = aggregationRepository;
        this.summaryRepository = summaryRepository;
        this.applicationRepository = applicationRepository;
        this.infrastructureService = infrastructureService;
        this.anomalyService = anomalyService;
    }

    @GetMapping("/stability")
    public List<LogAggregationWindow> getStabilityData(@RequestParam Long environmentId) {
        List<Application> apps = applicationRepository.findByEnvironmentId(environmentId);
        if (apps.isEmpty()) return List.of();
        // Use the first app as a representative for the environment's overall stability trend
        return aggregationRepository.findTop24ByApplicationOrderByWindowEndDesc(apps.get(0));
    }

    @GetMapping("/digest")
    public ResponseEntity<AiOperationalSummary> getLatestSummary(@RequestParam Long environmentId) {
        List<Application> apps = applicationRepository.findByEnvironmentId(environmentId);
        
        if (apps.isEmpty()) {
            // Return a default summary if no apps exist yet
            return ResponseEntity.ok(AiOperationalSummary.builder()
                    .summaryText("No applications deployed in this environment yet. Deploy your first service to begin tracking operational health.")
                    .businessRisk("LOW")
                    .generatedAt(java.time.LocalDateTime.now())
                    .build());
        }

        return summaryRepository.findTopByApplicationIdOrderByGeneratedAtDesc(apps.get(0).getId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.ok(AiOperationalSummary.builder()
                        .summaryText("No operational data available for " + apps.get(0).getName() + " yet. The next analysis cycle will generate a summary.")
                        .businessRisk("LOW")
                        .generatedAt(java.time.LocalDateTime.now())
                        .build()));
    }

    @GetMapping("/heatmap")
    public Map<String, Object> getHeatmap(@RequestParam Long environmentId) {
        return infrastructureService.getEnvironmentHeatmap(environmentId);
    }

    @GetMapping("/anomalies")
    public List<com.monetique.eye.dto.AnomalyResponse> getAnomalies(@RequestParam Long environmentId) {
        return anomalyService.getRecentAnomalies(environmentId);
    }

    @GetMapping("/incidents")
    public List<com.monetique.eye.dto.IncidentDTO> getIncidents(@RequestParam Long environmentId) {
        return infrastructureService.getEnvironmentIncidents(environmentId);
    }
}
