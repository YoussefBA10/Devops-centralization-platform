package com.monetique.eye.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardOverviewResponse {
    private int totalNodes;
    private double stabilityIndex;
    private int openTickets;
    private List<ActivityItem> recentActivity;
    private List<String> healthStream;
    private List<Double> systemLoad;
}
