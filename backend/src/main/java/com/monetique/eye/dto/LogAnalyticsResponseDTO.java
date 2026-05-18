package com.monetique.eye.dto;

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
public class LogAnalyticsResponseDTO {
    private List<MetricCard> summaryCards;
    private ChartData trafficCorrelation;
    private ChartData probeSuccess;
    private List<ErrorPattern> topErrors;
    private List<ResourcePressure> resourcePressure;
    private List<RootCauseRule> rootCauseChain;
    private List<LogEventDTO> liveLogs;
    private List<String> availableServices;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MetricCard {
        private String label;
        private String value;
        private String delta;
        private String status; // danger, warning, neutral
        private String source; // loki, prometheus, etc.
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChartData {
        private List<String> labels; // Time labels
        private List<Series> datasets;

        @Data
        @Builder
        @NoArgsConstructor
        @AllArgsConstructor
        public static class Series {
            private String label;
            private List<Double> data;
            private String color;
            private boolean dashed;
            private boolean fill;
        }
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ErrorPattern {
        private String service;
        private String endpoint;
        private String messageExcerpt;
        private int statusCode;
        private long count;
        private List<Integer> sparkline;
        private String source;
        private String firstSeen;
        private String lastSeen;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ResourcePressure {
        private String containerName;
        private double memoryUsage; // percentage
        private double cpuUsage;    // percentage or value
        private Double diskUsage;   // percentage
        private String callout;     // optional warning text
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RootCauseRule {
        private String id;
        private String type; // trigger, root_cause, cascade, impact
        private String title;
        private String description;
        private String confidence; // high, medium, low
        private Double probability; // new percentage distribution
        private List<String> evidence;
        private List<String> sources;
    }
}
