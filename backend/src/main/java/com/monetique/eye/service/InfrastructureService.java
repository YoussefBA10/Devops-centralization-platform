package com.monetique.eye.service;

import com.monetique.eye.dto.StabilityResponse;
import com.monetique.eye.entity.LogAggregationWindow;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.repository.LogAggregationWindowRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

@Service
@RequiredArgsConstructor
@Slf4j
public class InfrastructureService {

    private final PrometheusClient prometheusClient;
    private final EnvironmentRepository environmentRepository;
    private final ApplicationRepository applicationRepository;
    private final LogAggregationWindowRepository aggregationRepository;

    // Cache last stability for trend calculation
    private final AtomicReference<Double> lastStabilityScore = new AtomicReference<>(99.6);

    public StabilityResponse getGlobalStability() {
        try {
            int totalEnvs = (int) environmentRepository.count();
            int activeNodes = prometheusClient.getTotalActiveNodes().intValue();

            // 1. Error Penalty (60% weight)
            // In a real scenario, we'd calculate a global Z-score deviation.
            // For now, we average the 'error counts' across recent windows to find outliers.
            double avgZScoreErrors = applicationRepository.findAll().stream()
                    .map(app -> aggregationRepository.findTop24ByApplicationOrderByWindowEndDesc(app))
                    .filter(list -> !list.isEmpty())
                    .mapToDouble(list -> {
                        // Estimate z-score of the most recent window relative to its 24h baseline
                        LogAggregationWindow latest = list.get(0);
                        double mean = list.stream().mapToDouble(LogAggregationWindow::getErrorCount).average().orElse(0.0);
                        double variance = list.stream().mapToDouble(w -> Math.pow(w.getErrorCount() - mean, 2)).average().orElse(0.0);
                        double stdDev = Math.sqrt(variance);
                        return stdDev > 0 ? (latest.getErrorCount() - mean) / stdDev : 0.0;
                    })
                    .average()
                    .orElse(0.0);

            double errorPenalty = Math.max(0, avgZScoreErrors * 15);

            // 2. Resource Penalty (30% weight)
            // Querying global averages from Prometheus
            Double avgCpu = prometheusClient.queryMetric("avg(1 - rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100");
            Double avgRam = prometheusClient.queryMetric("avg((1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100)");
            Double avgDisk = prometheusClient.queryMetric("avg(max(1 - (node_filesystem_avail_bytes{mountpoint=\"/\"} / node_filesystem_size_bytes{mountpoint=\"/\"})) by (instance) * 100)");

            double cpuOver = Math.max(0, (avgCpu != null ? avgCpu : 0.0) - 80);
            double ramOver = Math.max(0, (avgRam != null ? avgRam : 0.0) - 85);
            double diskOver = Math.max(0, (avgDisk != null ? avgDisk : 0.0) - 90);
            double resourcePenalty = (cpuOver + ramOver + diskOver) * 8;

            // 3. Drift Penalty (10% weight)
            double avgLogDrift = 0.0; // Placeholder for future implementation
            double driftPenalty = avgLogDrift * 10;

            // Global Stability Calculation
            double stability = 100 - (errorPenalty * 0.6 + resourcePenalty * 0.3 + driftPenalty * 0.1);
            stability = Math.max(0.0, Math.min(100.0, stability));

            // Trend Calculation
            double previous = lastStabilityScore.getAndSet(stability);
            double trend = stability - previous;

            return StabilityResponse.builder()
                    .avgStability(stability)
                    .trend(trend)
                    .totalEnvironments(totalEnvs)
                    .activeAgents(activeNodes)
                    .calculationTimestamp(LocalDateTime.now())
                    .build();

        } catch (Exception e) {
            log.error("Failed to calculate global stability: {}", e.getMessage(), e);
            // Fallback to safe defaults
            return StabilityResponse.builder()
                    .avgStability(lastStabilityScore.get())
                    .trend(0.0)
                    .totalEnvironments(0)
                    .activeAgents(0)
                    .calculationTimestamp(LocalDateTime.now())
                    .build();
        }
    }
}
