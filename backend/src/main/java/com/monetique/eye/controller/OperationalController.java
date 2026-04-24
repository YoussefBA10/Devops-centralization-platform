package com.monetique.eye.controller;

import com.monetique.eye.entity.AiOperationalSummary;
import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.LogAggregationWindow;
import com.monetique.eye.repository.AiOperationalSummaryRepository;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.LogAggregationWindowRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.monetique.eye.service.InfrastructureService;
import com.monetique.eye.service.AnomalyService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/operational")
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
        return aggregationRepository.findTop24ByApplicationOrderByWindowEndDesc(apps.get(0));
    }

    @GetMapping("/digest")
    public ResponseEntity<AiOperationalSummary> getLatestSummary(@RequestParam Long environmentId) {
        List<Application> apps = applicationRepository.findByEnvironmentId(environmentId);
        if (apps.isEmpty()) return ResponseEntity.notFound().build();

        return summaryRepository.findTopByApplicationIdOrderByGeneratedAtDesc(apps.get(0).getId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/heatmap")
    public Map<String, Object> getHeatmap(@RequestParam Long environmentId) {
        return infrastructureService.getEnvironmentHeatmap(environmentId);
    }

    @GetMapping("/anomalies")
    public List<com.monetique.eye.dto.AnomalyResponse> getAnomalies(@RequestParam Long environmentId) {
        return anomalyService.getRecentAnomalies(environmentId);
    }
}
