package com.monetique.eye.dto;

import lombok.Data;
import java.util.Map;

@Data
public class DeployRequestDTO {
    private Long id;
    private String name;
    private Long environmentId;
    private String type;
    private String appLanguage;
    private String repoUrl;
    private String targetNode;
    private String branch;
    private Integer port;
    private Map<String, String> envVars;
    private String sshPassword;
    private String srcPath;
    private Integer containerPort;
    private Boolean autoGenerateConfig;

}
