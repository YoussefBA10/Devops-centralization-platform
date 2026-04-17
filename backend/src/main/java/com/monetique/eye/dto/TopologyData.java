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
        private String status; // 'HEALTHY', 'WARNING', 'CRITICAL'
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
