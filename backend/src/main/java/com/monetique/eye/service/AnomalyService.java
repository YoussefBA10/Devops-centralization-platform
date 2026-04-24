package com.monetique.eye.service;

import com.monetique.eye.dto.AnomalyResponse;
import com.monetique.eye.dto.ServiceResourceDTO;
import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.LogAggregationWindow;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.LogAggregationWindowRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnomalyService {

    private final InfrastructureService infrastructureService;
    private final LogAggregationWindowRepository aggregationRepository;
    private final ApplicationRepository applicationRepository;

    public List<AnomalyResponse> getRecentAnomalies(Long environmentId) {
        List<AnomalyResponse> anomalies = new ArrayList<>();

        // 1. Detect Resource Anomalies (From Infrastructure Service)
        List<ServiceResourceDTO> resources = infrastructureService.getEnvironmentServiceResources(environmentId);
        for (ServiceResourceDTO res : resources) {
            if (res.getCpuUsagePercent() > 85) {
                anomalies.add(AnomalyResponse.builder()
                        .description("High CPU Usage: " + res.getServiceName())
                        .node(res.getNodeName())
                        .severity("CRITICAL")
                        .type("RESOURCE")
                        .timestamp(LocalDateTime.now())
                        .build());
            }
            if (res.getMemoryUsagePercent() > 90) {
                anomalies.add(AnomalyResponse.builder()
                        .description("Memory Exhaustion Warning: " + res.getServiceName())
                        .node(res.getNodeName())
                        .severity("CRITICAL")
                        .type("RESOURCE")
                        .timestamp(LocalDateTime.now())
                        .build());
            }
            if (res.getRestartCount() > 0) {
                anomalies.add(AnomalyResponse.builder()
                        .description("Service Instability: " + res.getServiceName() + " restarted " + res.getRestartCount() + " times")
                        .node(res.getNodeName())
                        .severity("WARNING")
                        .type("RESTART")
                        .timestamp(LocalDateTime.now())
                        .build());
            }
            if ("CRITICAL".equals(res.getStatus())) {
                anomalies.add(AnomalyResponse.builder()
                        .description("Service Down: " + res.getServiceName())
                        .node(res.getNodeName())
                        .severity("CRITICAL")
                        .type("STATUS")
                        .timestamp(LocalDateTime.now())
                        .build());
            }
        }

        // 2. Detect Log Volume Anomalies (Z-Score on Error counts)
        List<Application> apps = applicationRepository.findByEnvironmentId(environmentId);
        for (Application app : apps) {
            List<LogAggregationWindow> windows = aggregationRepository.findTop24ByApplicationOrderByWindowEndDesc(app);
            if (windows.size() >= 5) {
                LogAggregationWindow latest = windows.get(0);
                double mean = windows.stream().mapToDouble(LogAggregationWindow::getErrorCount).average().orElse(0.0);
                double variance = windows.stream().mapToDouble(w -> Math.pow(w.getErrorCount() - mean, 2)).average().orElse(0.0);
                double stdDev = Math.sqrt(variance);
                
                double zScore = stdDev > 0 ? (latest.getErrorCount() - mean) / stdDev : 0.0;
                
                if (zScore > 2.0 && latest.getErrorCount() > 5) {
                    anomalies.add(AnomalyResponse.builder()
                            .description("Statistical Log Anomaly: Unusual error volume in " + app.getName())
                            .node(latest.getNode() != null ? latest.getNode() : app.getTargetNode())
                            .severity("WARNING")
                            .type("LOG")
                            .timestamp(latest.getWindowEnd())
                            .build());
                }
            }
        }

        // Sort by timestamp descending
        anomalies.sort((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()));
        
        // Limit to top 10
        return anomalies.size() > 10 ? anomalies.subList(0, 10) : anomalies;
    }
}
