package com.monetique.eye.service;

import com.monetique.eye.dto.ActivityItem;
import com.monetique.eye.dto.AnomalyResponse;
import com.monetique.eye.dto.DashboardOverviewResponse;
import com.monetique.eye.dto.ServiceResourceDTO;
import com.monetique.eye.entity.Environment;
import com.monetique.eye.entity.LogAggregationWindow;
import com.monetique.eye.entity.Ticket;
import com.monetique.eye.repository.ActivityLogRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.repository.LogAggregationWindowRepository;
import com.monetique.eye.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DashboardService {

    private final EnvironmentRepository environmentRepository;
    private final TicketRepository ticketRepository;
    private final LogAggregationWindowRepository aggregationRepository;
    private final InfrastructureService infrastructureService;
    private final AnomalyService anomalyService;
    private final ActivityLogRepository activityLogRepository;

    public DashboardOverviewResponse getDashboardOverview() {
        List<Environment> environments = environmentRepository.findAll();
        
        Set<String> uniqueNodes = new HashSet<>();
        List<Double> allCpuLoads = new ArrayList<>();
        List<String> healthStream = new ArrayList<>();

        for (Environment env : environments) {
            try {
                // 1. Nodes and Load
                List<ServiceResourceDTO> resources = infrastructureService.getEnvironmentServiceResources(env.getId());
                for (ServiceResourceDTO res : resources) {
                    uniqueNodes.add(res.getNodeName());
                    allCpuLoads.add(res.getCpuUsagePercent());
                    
                    if (healthStream.size() < 10) {
                        healthStream.add("> " + res.getServiceName() + " on " + res.getNodeName() + " - " + res.getStatus());
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to fetch data for environment: {}", env.getName());
            }
        }
        
        // Fetch all activities from the last 24 hours
        LocalDateTime twentyFourHoursAgo = LocalDateTime.now().minusHours(24);
        List<ActivityItem> activities = activityLogRepository.findAllByTimestampAfterOrderByTimestampDesc(twentyFourHoursAgo).stream()
                .map(log -> ActivityItem.builder()
                        .title(log.getTitle())
                        .type(log.getType())
                        .env(log.getEnv())
                        .timestamp(log.getTimestamp())
                        .build())
                .collect(Collectors.toList());
        
        // Calculate Stability Index dynamically
        double averageStability = infrastructureService.getGlobalStability().getAvgStability(); 

        
        if (healthStream.isEmpty()) {
            healthStream.add("> SYS-OK: all services operational [global]");
            healthStream.add("> METRIC-DB: write success");
        }
        
        // Sort loads descending and take top 7 for the chart
        allCpuLoads.sort(Collections.reverseOrder());
        List<Double> topLoads = allCpuLoads.stream().limit(7).collect(Collectors.toList());
        while (topLoads.size() < 7) {
            topLoads.add(0.0); // Fill empty bars
        }

        return DashboardOverviewResponse.builder()
                .totalNodes(uniqueNodes.size())
                .stabilityIndex(averageStability)
                .openTickets((int) ticketRepository.findAll().stream()
                        .filter(t -> t.getStatus() == com.monetique.eye.entity.enums.TicketStatus.OPEN || 
                                     t.getStatus() == com.monetique.eye.entity.enums.TicketStatus.IN_PROGRESS ||
                                     t.getStatus() == com.monetique.eye.entity.enums.TicketStatus.REOPENED ||
                                     t.getStatus() == com.monetique.eye.entity.enums.TicketStatus.ESCALATED)
                        .count())
                .recentActivity(activities)
                .healthStream(healthStream)
                .systemLoad(topLoads)
                .build();
    }
}
