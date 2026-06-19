package com.monetique.eye.security.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttackSurfaceDto {
    private List<AttackSurfaceNode> nodes;
    private List<AttackSurfaceEdge> edges;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AttackSurfaceNode {
        private String id;
        private String label;
        private String type;
        private String status;
        private int criticalVulns;
        private int highVulns;
        private int falcoEvents24h;
        private Long applicationId;
        private String nodeName;
        private Integer port;
        private String environmentName;
        private String parentId;
        private String dockerHost;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AttackSurfaceEdge {
        private String id;
        private String source;
        private String target;
        private String type;
        private boolean vulnerable;
    }
}
