package com.monetique.eye.security.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FalcoSummaryDto {
    private int totalLast24h;
    private Map<String, Integer> byPriority;
    private List<RuleCount> topRules;
    private List<HourlyCount> hourlyTimeline;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RuleCount {
        private String ruleName;
        private int count;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HourlyCount {
        private String hour;
        private int count;
    }
}
