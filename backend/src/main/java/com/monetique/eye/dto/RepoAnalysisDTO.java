package com.monetique.eye.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
public class RepoAnalysisDTO {

    @Data
    public static class Request {
        private String repoUrl;
        private String branch;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DetectedApp {
        private String name;
        private String type;       // BACKEND / FRONTEND
        private String framework;  // Java Spring Boot, React, Node.js, Python, Go, Vue.js
        private String srcPath;    // backend/, frontend/, .
        private boolean hasDockerfile;
        private boolean hasNginxConf;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Response {
        private String repoName;
        private List<DetectedApp> apps;
        private String error;
    }
}
