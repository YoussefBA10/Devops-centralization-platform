package com.monetique.eye.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApplicationDTO {
    private Long id;
    private String name;
    private String type;
    private String appLanguage;
    private String repoUrl;
    private String targetNode;
    private String branch;
    private Integer port;
    private String status;
    private LocalDateTime lastDeployedAt;
    private LocalDateTime createdAt;
    private Long environmentId;
    private String srcPath;
    private Integer containerPort;
    private Boolean isCanary;
    private Integer canaryPort;
    private String lastErrorMessage;
    private String githubInstallationId;
    private String githubRepoFullName;
    private String githubRepoUrl;
    private String gitToken;
    private java.util.Map<String, String> envVars;
    private String environmentName;
    private Long nodeId;
    private String nodeName;
}
