package com.monetique.eye.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TopologyData {
    @Builder.Default
    private List<TopologyNode> nodes = new java.util.ArrayList<>();
    @Builder.Default
    private List<TopologyEdge> edges = new java.util.ArrayList<>();
    @Builder.Default
    private List<ClusterGroup> clusters = new java.util.ArrayList<>();

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ClusterGroup {
        private Long id;
        private String name;
        private String description;
        private List<EnvironmentGroup> environments;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class EnvironmentGroup {
        private Long id;
        private String name;
        private String prometheusLabel;
        private List<TopologyNode> nodes;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TopologyNode {
        private String id;
        private String label;
        private String ip;
        private String type; // 'server' or 'db-server'
        private Integer cpu;
        private Integer ram;
        private Integer disk;
        private String status; // 'HEALTHY', 'WARNING', 'CRITICAL', 'OFFLINE'
        private String environmentName;
        private Long environmentId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TopologyEdge {
        private String source;
        private String target;
    }
}
