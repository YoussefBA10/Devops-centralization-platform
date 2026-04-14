package com.monetique.eye.controller;

import com.monetique.eye.entity.AiOperationalSummary;
import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.LogAggregationWindow;
import com.monetique.eye.repository.AiOperationalSummaryRepository;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.LogAggregationWindowRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/operational")
public class OperationalController {

    private final LogAggregationWindowRepository aggregationRepository;
    private final AiOperationalSummaryRepository summaryRepository;
    private final ApplicationRepository applicationRepository;

    public OperationalController(LogAggregationWindowRepository aggregationRepository,
                                 AiOperationalSummaryRepository summaryRepository,
                                 ApplicationRepository applicationRepository) {
        this.aggregationRepository = aggregationRepository;
        this.summaryRepository = summaryRepository;
        this.applicationRepository = applicationRepository;
    }

    @GetMapping("/stability")
    public List<LogAggregationWindow> getStabilityData(@RequestParam Long environmentId) {
        List<Application> apps = applicationRepository.findByEnvironmentId(environmentId);
        if (apps.isEmpty()) return List.of();
        // Return stability for the primary application in the environment for the test
        return aggregationRepository.findTop24ByApplicationIdOrderByWindowEndDesc(apps.get(0).getId());
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
        // Stub implementation returning simulated risk heatmap for the environment
        return Map.of(
                "environmentId", environmentId,
                "nodes", List.of(
                        Map.of("id", "node-01", "riskScore", 15, "status", "HEALTHY"),
                        Map.of("id", "node-02", "riskScore", 85, "status", "CRITICAL")
                )
        );
    }
}
