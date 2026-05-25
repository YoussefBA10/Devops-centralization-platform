package com.monetique.eye.service;

import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.DeploymentLog;
import com.monetique.eye.entity.Environment;
import com.monetique.eye.entity.enums.DeploymentStatus;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.DeploymentLogRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.annotation.PostConstruct;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;

@Service
public class DeploymentService {

    private static final Logger log = LoggerFactory.getLogger(DeploymentService.class);

    private final DeploymentLogRepository deploymentLogRepository;
    private final EnvironmentRepository environmentRepository;
    private final ApplicationRepository applicationRepository;
    private final com.monetique.eye.repository.ManagedNodeRepository managedNodeRepository;
    private final ObjectMapper objectMapper;
    private final com.monetique.eye.repository.GitHubTokenRepository gitHubTokenRepository;

    @Value("${monetique.gitops.path}")
    private String gitopsPath;

    private final com.monetique.eye.service.ActivityLogService activityLogService;


    @PostConstruct
    public void init() {
        log.info("Checking configured gitopsPath: {}", gitopsPath);
        if (gitopsPath == null) {
            log.warn("gitopsPath is null. Attempting auto-discovery...");
        }
        File f = (gitopsPath != null) ? new File(gitopsPath) : null;
        if (f == null || !f.exists()) {
            log.warn("Path '{}' does not exist or is null. Attempting auto-discovery...", gitopsPath);
            // Try common locations
            if (new File("./gitops").exists()) {
                gitopsPath = new File("./gitops").getAbsolutePath();
            } else if (new File("../gitops").exists()) {
                gitopsPath = new File("../gitops").getAbsolutePath();
            } else if (new File("/app/gitops").exists()) {
                gitopsPath = "/app/gitops";
            }
            log.info("Final resolved gitopsPath: {}", gitopsPath);
        } else {
            gitopsPath = f.getAbsolutePath();
            log.info("Using validated gitopsPath: {}", gitopsPath);
        }
    }


    private String getSafeGroupName(String name) {
        if (name == null) return "unknown";
        return name.toLowerCase().replaceAll("[^a-z0-9]", "-");
    }

    public DeploymentService(DeploymentLogRepository deploymentLogRepository,
            EnvironmentRepository environmentRepository,
            ApplicationRepository applicationRepository,
            com.monetique.eye.repository.ManagedNodeRepository managedNodeRepository,
            ObjectMapper objectMapper,
            com.monetique.eye.repository.GitHubTokenRepository gitHubTokenRepository,
            com.monetique.eye.service.ActivityLogService activityLogService) {
        this.deploymentLogRepository = deploymentLogRepository;
        this.environmentRepository = environmentRepository;
        this.applicationRepository = applicationRepository;
        this.managedNodeRepository = managedNodeRepository;
        this.objectMapper = objectMapper;
        this.gitHubTokenRepository = gitHubTokenRepository;
        this.activityLogService = activityLogService;
    }

    @Async
    public CompletableFuture<DeploymentLog> deployAgentAsync(Environment environment, String targetIp, String sshUser,
            String sshPassword, String osFamily) {
        return deployAgentAsync(environment, targetIp, sshUser, sshPassword, osFamily, true);
    }

    @Async
    public CompletableFuture<DeploymentLog> deployAgentAsync(Environment environment, String targetIp, String sshUser,
            String sshPassword, String osFamily, boolean containerized) {
        log.info("Starting agent deployment for environment: {} at IP: {} (containerized: {})", environment.getName(), targetIp, containerized);

        DeploymentLog deploymentLog = DeploymentLog.builder()
                .environment(environment)
                .action("DEPLOY_AGENT")
                .targetIp(targetIp)
                .status("IN_PROGRESS")
                .logOutput("")
                .build();
        deploymentLog = deploymentLogRepository.save(deploymentLog);

        try {
            // 0. Ensure scripts are executable
            executeProcess(new String[] { "chmod", "+x", gitopsPath + "/scripts/ssh-configure.sh" }, deploymentLog, 30);

            // 1. Update Inventory
            updateInventory(environment.getName(), targetIp, sshUser);

            // 2. Execute SSH Configure Script (Accepts USER, IP, PASSWORD)
            executeProcessSecure(
                    new String[] { "bash", gitopsPath + "/scripts/ssh-configure.sh", sshUser, targetIp, sshPassword },
                    deploymentLog, 300);

            // 3. Deploy based on mode
            String rawLabel = environment.getPrometheusLabel();
            String envLabel = (rawLabel != null && rawLabel.contains("=")) ? rawLabel.substring(rawLabel.indexOf('=') + 1) : rawLabel;
            if (envLabel == null || envLabel.isEmpty()) {
                envLabel = environment.getSafeName();
            }
            String centralIp = getCentralIp(environment);
            String nodeName = targetIp.equals(centralIp) ? "central-node"
                    : "node-" + targetIp.replace(".", "-");

            if (!containerized) {
                // ── STANDALONE MODE: Raw SSH deployment (no Python/Ansible needed on remote) ──
                String standaloneScript = gitopsPath + "/scripts/deploy-standalone.sh";
                executeProcess(new String[] { "chmod", "+x", standaloneScript }, deploymentLog, 30);
                executeProcessSecure(new String[] {
                        "bash", standaloneScript,
                        sshUser, targetIp,
                        "/app/gitops/image-cache",
                        envLabel, nodeName
                }, deploymentLog, 600);
            } else {
                // ── CONTAINERIZED MODE: Ansible playbook (requires Python 3 on remote) ──
                String playbookPath = gitopsPath + "/ansible/deploy-tools.yml";
                String inventoryPath = gitopsPath + "/ansible/inventory.ini";

                executeProcessSecure(new String[] {
                        "ansible-playbook",
                        "-i", inventoryPath,
                        playbookPath,
                        "--limit", targetIp,
                        "-e", "ansible_ssh_pass=" + sshPassword,
                        "-e", "env_label=" + envLabel,
                        "-e", "ansible_user=" + sshUser,
                        "-e", "ssh_user=" + sshUser,
                        "-e", "target_host=" + targetIp,
                        "-e", "central_logstash_ip=" + centralIp,
                        "-e", "nodename=" + nodeName,
                        "-e", "containerized=true"
                }, deploymentLog, 600);
            }

            deploymentLog.setStatus("SUCCESS");
            
            // Extract dynamic cAdvisor and Node Exporter ports from logs if present
            Integer detectedCadvisorPort = 8085; // Default fallback
            Integer detectedNodeExporterPort = 9100; // Default fallback
            String fullLog = deploymentLog.getLogOutput();
            
            if (fullLog != null) {
                // Parse cAdvisor
                if (fullLog.contains("FINAL_CADVISOR_PORT=")) {
                    try {
                        int start = fullLog.indexOf("FINAL_CADVISOR_PORT=") + 20;
                        int end = fullLog.indexOf("\"", start);
                        if (end == -1) end = fullLog.indexOf("\n", start);
                        if (end != -1) {
                            detectedCadvisorPort = Integer.parseInt(fullLog.substring(start, end).trim());
                        }
                    } catch (Exception ex) { log.warn("Failed to parse cAdvisor port: {}", ex.getMessage()); }
                }
                // Parse Node Exporter
                if (fullLog.contains("FINAL_NODE_EXPORTER_PORT=")) {
                    try {
                        int start = fullLog.indexOf("FINAL_NODE_EXPORTER_PORT=") + 25;
                        int end = fullLog.indexOf("\"", start);
                        if (end == -1) end = fullLog.indexOf("\n", start);
                        if (end != -1) {
                            detectedNodeExporterPort = Integer.parseInt(fullLog.substring(start, end).trim());
                        }
                    } catch (Exception ex) { log.warn("Failed to parse Node Exporter port: {}", ex.getMessage()); }
                }
                log.info("Detected dynamic ports for IP {}: cAdvisor={}, NodeExporter={}", targetIp, detectedCadvisorPort, detectedNodeExporterPort);
            }

            // Persist Managed Node credentials
            com.monetique.eye.entity.ManagedNode managedNode = managedNodeRepository.findByEnvironmentAndIp(environment, targetIp)
                    .orElse(com.monetique.eye.entity.ManagedNode.builder()
                            .environment(environment)
                            .ip(targetIp)
                            .build());
            
            managedNode.setSshUser(sshUser);
            managedNode.setSshPassword(sshPassword);
            managedNode.setNodeName(nodeName);
            managedNode.setCadvisorPort(detectedCadvisorPort);
            managedNode.setNodeExporterPort(detectedNodeExporterPort);
            managedNode.setContainerized(containerized);
            managedNode = managedNodeRepository.save(managedNode);

            // Register in Prometheus with the persisted node ID
            registerNodeInPrometheus(environment, targetIp, managedNode.getId());

            environment.setLastDeploymentStatus(DeploymentStatus.SUCCESS);
            environment.setLastDeployedAt(java.time.LocalDateTime.now());
            environmentRepository.save(environment);
        } catch (Exception e) {
            log.error("Deployment failed: {}", e.getMessage());
            deploymentLog.setStatus("FAILED");
            
            // Cleanup technical artifacts on failure
            removeFromInventory(targetIp);
            deregisterNodeFromPrometheus(targetIp);
            
            environment.setLastDeploymentStatus(DeploymentStatus.FAILED);
            environmentRepository.save(environment);
            String fullLogContent = (deploymentLog.getLogOutput() == null ? "" : deploymentLog.getLogOutput())
                    + "\nERROR: " + e.getMessage();
            deploymentLog.setLogOutput(fullLogContent);
            deploymentLog.setShortError(extractSimpleErrorMessage(fullLogContent));
        } finally {
            deploymentLogRepository.save(deploymentLog);
        }
        return CompletableFuture.completedFuture(deploymentLog);
    }

    @Async
    public CompletableFuture<Void> undeployAgentAsync(Environment environment, String targetIp, String sshUser,
            String sshPassword) {
        log.info("Starting undeployment for IP: {} (Environment: {})", targetIp, environment.getName());
        try {
            // 1. Run Ansible Undeploy Playbook (Only if credentials exist)
            if (sshUser != null && !sshUser.isEmpty()) {
                String playbookPath = gitopsPath + "/ansible/undeploy-node.yml";

                // Generate a temporary inventory for just this target to ensure we don't
                // undeploy others accidentally
                File tempInventory = File.createTempFile("undeploy-inventory", ".ini");
                try (FileWriter writer = new FileWriter(tempInventory)) {
                    writer.write("[agents]\n" + targetIp + " ansible_user=" + sshUser + "\n");
                }

                List<String> commandList = new ArrayList<>(List.of(
                        "ansible-playbook",
                        "-i", tempInventory.getAbsolutePath(),
                        playbookPath,
                        "--limit", targetIp,
                        "-e", "target_host=" + targetIp,
                        "-e", "ssh_user=" + sshUser));

                if (sshPassword != null && !sshPassword.isEmpty()) {
                    commandList.add("-e");
                    commandList.add("ansible_ssh_pass=" + sshPassword);
                    executeProcessSecure(commandList.toArray(new String[0]), new DeploymentLog(), 300);
                } else {
                    executeProcess(commandList.toArray(new String[0]), new DeploymentLog(), 300);
                }

                tempInventory.delete();
            } else {
                log.warn("Skipping remote undeployment for {} as no SSH credentials were provided. Only cleaning up local records.", targetIp);
            }

            // 2. Remove from Prometheus
            deregisterNodeFromPrometheus(targetIp);

            // 3. Remove from main inventory
            removeFromInventory(targetIp);

            // 4. Cleanup DB records
            managedNodeRepository.findByEnvironmentAndIp(environment, targetIp)
                .ifPresent(managedNodeRepository::delete);

            log.info("Successfully undeployed agent {}", targetIp);
        } catch (Exception e) {
            log.error("Undeployment failed for {}: {}", targetIp, e.getMessage());
        }
        return CompletableFuture.completedFuture(null);
    }

    @Transactional
    public void deleteNodeFromDbOnly(Environment environment, String targetIp) {
        log.info("Deleting node {} from DB and configuration files only (no remote execution)", targetIp);
        try {
            deregisterNodeFromPrometheus(targetIp);
            removeFromInventory(targetIp);
            managedNodeRepository.findByEnvironmentAndIp(environment, targetIp)
                .ifPresent(managedNodeRepository::delete);
        } catch (Exception e) {
            log.error("Failed to delete node {} from database: {}", targetIp, e.getMessage());
        }
    }

    @Async
    public void deployApplication(Environment environment, String targetIp, String sshUser, String appName) {
        log.info("Starting application deployment for environment: {} at IP: {}, App: {}", environment.getName(),
                targetIp, appName);

        DeploymentLog deploymentLog = DeploymentLog.builder()
                .environment(environment)
                .action("DEPLOY_APP")
                .targetIp(targetIp)
                .appName(appName)
                .status("IN_PROGRESS")
                .logOutput("")
                .build();
        deploymentLog = deploymentLogRepository.save(deploymentLog);

        try {
            // 1. Update Inventory
            // updateInventory(environment.getName(), targetIp, sshUser);

            // 2. Select Playbook
            String playbookFile = "deploy-backend.yml";
            if (appName.toLowerCase().contains("frontend")) {
                playbookFile = "deploy-frontend.yml";
            }

            String playbookPath = gitopsPath + "/ansible/" + playbookFile;
            String inventoryPath = gitopsPath + "/ansible/inventory.ini";
            String centralIp = getCentralIp(environment);

            String nodeName = targetIp.equals(centralIp) ? "central-node"
                    : "node-" + targetIp.replace(".", "-");

            // Fetch credentials from ManagedNode
            com.monetique.eye.entity.ManagedNode node = managedNodeRepository.findByEnvironmentAndIp(environment, targetIp)
                    .orElse(null);
            String sshPass = (node != null) ? node.getSshPassword() : null;

            List<String> commandList = new ArrayList<>(List.of(
                    "ansible-playbook",
                    "-i", inventoryPath,
                    playbookPath,
                    "--limit", targetIp,
                    "-e", "appName=" + appName,
                    "-e", "ansible_user=" + sshUser,
                    "-e", "central_ip=" + centralIp,
                    "-e", "nodename=" + nodeName));

            if (sshPass != null && !sshPass.isEmpty()) {
                commandList.add("-e");
                commandList.add("ansible_ssh_pass=" + sshPass);
                executeProcessSecure(commandList.toArray(new String[0]), deploymentLog, 600);
            } else {
                executeProcess(commandList.toArray(new String[0]), deploymentLog, 600);
            }

            deploymentLog.setStatus("SUCCESS");
            activityLogService.logActivity("Application Deployed: " + appName, "deployment", environment.getName());

            // Auto-create application record if not exists
            if (applicationRepository.findAll().stream()
                    .noneMatch(a -> a.getName().equalsIgnoreCase(appName)
                            && a.getEnvironment().getId().equals(environment.getId()))) {

                Application app = Application.builder()
                        .name(appName)
                        .environment(environment)
                        .serviceNameKeyword(appName.toLowerCase())
                        .build();
                applicationRepository.save(app);
                log.info("Auto-created application record for: {}", appName);
            }

        } catch (Exception e) {
            log.error("Application deployment failed: {}", e.getMessage());
            deploymentLog.setStatus("FAILED");
            deploymentLog.setLogOutput((deploymentLog.getLogOutput() == null ? "" : deploymentLog.getLogOutput())
                    + "\nERROR: " + e.getMessage());
        } finally {
            deploymentLogRepository.save(deploymentLog);
        }
    }

    @Async
    @Transactional
    public void undeployApplicationFull(Long applicationId) {
        Application app = applicationRepository.findById(applicationId)
                .orElse(null);
        if (app == null)
            return;

        Environment environment = app.getEnvironment();
        String appName = app.getName();
        String targetIp = app.getTargetNode();

        log.info("Starting application undeployment for App: {} on Node: {}", appName, targetIp);

        DeploymentLog deploymentLog = DeploymentLog.builder()
                .environment(environment)
                .action("UNDEPLOY_APP")
                .targetIp(targetIp)
                .appName(appName)
                .status("IN_PROGRESS")
                .logOutput("Starting undeployment of " + appName + " from " + targetIp + "...\n")
                .build();
        deploymentLog = deploymentLogRepository.save(deploymentLog);

        try {
            // Fetch credentials from ManagedNode
            com.monetique.eye.entity.ManagedNode node = managedNodeRepository.findByEnvironmentAndIp(environment, targetIp)
                    .orElseThrow(() -> new RuntimeException("Node credentials not found for IP: " + targetIp + ". Please register the node first."));

            String sshUser = node.getSshUser();
            String sshPass = node.getSshPassword();

            // Do NOT update global inventory here - rely on existing inventory or Extra Vars

            String playbookPath = gitopsPath + "/ansible/undeploy-app.yml";
            String inventoryPath = gitopsPath + "/ansible/inventory.ini";

            List<String> commandList = new ArrayList<>(List.of(
                    "ansible-playbook",
                    "-i", inventoryPath,
                    playbookPath,
                    "--limit", targetIp,
                    "-e", "appName=" + appName,
                    "-e", "target_host=" + targetIp));

            // Conditionally add Ansible coordinates only if stored
            if (sshUser != null && !sshUser.isEmpty()) {
                commandList.add("-e");
                commandList.add("ansible_user=" + sshUser);
            }

            if (sshPass != null && !sshPass.isEmpty()) {
                commandList.add("-e");
                commandList.add("ansible_ssh_pass=" + sshPass);
                executeProcessSecure(commandList.toArray(new String[0]), deploymentLog, 300);
            } else {
                executeProcess(commandList.toArray(new String[0]), deploymentLog, 300);
            }

            deploymentLog.setStatus("SUCCESS");
            activityLogService.logActivity("Application Undeployed: " + appName, "deployment", environment.getName());
            log.info("Undeployment successful for App: {}. Removing record from database.", appName);

            // Delete the application record after successful undeployment
            applicationRepository.deleteById(applicationId);

        } catch (Exception e) {
            log.error("Application undeployment failed: {}", e.getMessage());
            deploymentLog.setStatus("FAILED");
            deploymentLog.setLogOutput((deploymentLog.getLogOutput() == null ? "" : deploymentLog.getLogOutput())
                    + "\nERROR: " + e.getMessage());

            // Even if undeployment failed, we might want to delete the record to keep UI
            // clean,
            // or keep it to let user retry. Given the plan, we'll proceed to delete it
            // but log the failure in the general logs.
            applicationRepository.deleteById(applicationId);
        } finally {
            deploymentLogRepository.save(deploymentLog);
        }
    }

    @Async
    @Transactional
    public void restartApplicationFull(Long applicationId) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new RuntimeException("Application not found: " + applicationId));

        Environment environment = app.getEnvironment();
        String appName = app.getName();
        String targetIp = app.getTargetNode();

        log.info("Starting remote restart for App: {} on Node: {}", appName, targetIp);

        DeploymentLog deploymentLog = DeploymentLog.builder()
                .environment(environment)
                .action("RESTART_APP")
                .targetIp(targetIp)
                .appName(appName)
                .status("IN_PROGRESS")
                .logOutput("Triggering remote restart for " + appName + " on " + targetIp + "...\n")
                .build();
        deploymentLog = deploymentLogRepository.save(deploymentLog);

        try {
            // Fetch credentials from ManagedNode
            com.monetique.eye.entity.ManagedNode node = managedNodeRepository.findByEnvironmentAndIp(environment, targetIp)
                    .orElseThrow(() -> new RuntimeException("Node credentials not found for IP: " + targetIp + ". Please register the node first."));

            String sshUser = node.getSshUser();
            String sshPass = node.getSshPassword();

            // Do NOT update global inventory here - rely on existing inventory or Extra Vars

            String playbookPath = gitopsPath + "/ansible/restart-app.yml";
            String inventoryPath = gitopsPath + "/ansible/inventory.ini";

            List<String> commandList = new ArrayList<>(List.of(
                    "ansible-playbook",
                    "-i", inventoryPath,
                    playbookPath,
                    "--limit", targetIp,
                    "-e", "appName=" + appName,
                    "-e", "target_host=" + targetIp));

            // Conditionally add Ansible coordinates only if stored
            if (sshUser != null && !sshUser.isEmpty()) {
                commandList.add("-e");
                commandList.add("ansible_user=" + sshUser);
            }

            if (sshPass != null && !sshPass.isEmpty()) {
                commandList.add("-e");
                commandList.add("ansible_ssh_pass=" + sshPass);
                executeProcessSecure(commandList.toArray(new String[0]), deploymentLog, 120);
            } else {
                executeProcess(commandList.toArray(new String[0]), deploymentLog, 120);
            }

            deploymentLog.setStatus("SUCCESS");

            // Update application status back to RUNNING
            app.setStatus("RUNNING");
            applicationRepository.save(app);

        } catch (Exception e) {
            log.error("Application restart failed: {}", e.getMessage());
            deploymentLog.setStatus("FAILED");
            deploymentLog.setLogOutput((deploymentLog.getLogOutput() == null ? "" : deploymentLog.getLogOutput())
                    + "\nERROR: " + e.getMessage());

            // Update application status to FAILED
            app.setStatus("FAILED");
            applicationRepository.save(app);
        } finally {
            deploymentLogRepository.save(deploymentLog);
        }
    }

    @Async
    @Transactional
    public void deployApplicationFull(Long environmentId, com.monetique.eye.dto.DeployRequestDTO request,
            Long applicationId, String previousName, String userId, boolean isNew) {

        Environment environment = environmentRepository.findById(environmentId)
                .orElseThrow(() -> new RuntimeException("Environment not found: " + environmentId));
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new RuntimeException("Application not found: " + applicationId));

        log.info("Starting full application deployment for environment: {} at Target Node: {}, App: {}",
                environment.getName(), request.getTargetNode(), request.getName());

        DeploymentLog deploymentLog = DeploymentLog.builder()
                .environment(environment)
                .action("DEPLOY_APP_FULL")
                .targetIp(request.getTargetNode())
                .appName(request.getName())
                .status("IN_PROGRESS")
                .logOutput("Starting deployment of " + request.getName() + " on " + request.getTargetNode() + "...\n")
                .build();
        deploymentLog = deploymentLogRepository.save(deploymentLog);

        try {
            // Fetch credentials from ManagedNode
            com.monetique.eye.entity.ManagedNode node = managedNodeRepository.findByEnvironmentAndIp(environment, request.getTargetNode())
                    .orElseThrow(() -> new RuntimeException("Node credentials not found for IP: " + request.getTargetNode() + ". Please register the node first."));

            String sshUser = node.getSshUser();
            String sshPass = node.getSshPassword();

            // Do NOT update global inventory here - rely on existing inventory or Extra Vars

            String playbookPath = gitopsPath + "/ansible/deploy-app.yml";
            String inventoryPath = gitopsPath + "/ansible/inventory.ini";

            // Task 2: Rename & Canary Detection
            String oldAppName = (previousName != null && !previousName.isEmpty() && !previousName.equals(request.getName())) ? previousName : "";
            boolean isCanary = (request.getCanary() != null && request.getCanary()) || (request.getAutoPromote() != null && request.getAutoPromote());
            int hostPort = isCanary ? request.getPort() + 1000 : request.getPort();

            log.info("Deployment Details - Name: {}, Previous: {}, oldAppName: '{}', isCanary: {}, hostPort: {}, autoPromote: {}, targetNode: {}", 
                    request.getName(), previousName, oldAppName, isCanary, hostPort, request.getAutoPromote(), request.getTargetNode());

            String centralIp = getCentralIp(environment);
            String nodeName = request.getTargetNode().equals(centralIp) ? "central-node"
                    : "node-" + request.getTargetNode().replace(".", "-");

            String buildArgsStr = "";
            if (request.getEnvVars() != null && !request.getEnvVars().isEmpty()) {
                buildArgsStr = request.getEnvVars().entrySet().stream()
                        .map(e -> "--build-arg " + e.getKey() + "=\"" + e.getValue() + "\"")
                        .reduce("", (a, b) -> a + " " + b).trim();
            }

            String finalRepoUrl = request.getRepoUrl();
            if (request.getGitToken() != null && !request.getGitToken().isEmpty()) {
                if (finalRepoUrl.startsWith("https://")) {
                    finalRepoUrl = "https://" + request.getGitToken() + "@" + finalRepoUrl.substring(8);
                } else if (!finalRepoUrl.startsWith("http")) {
                    finalRepoUrl = "https://" + request.getGitToken() + "@github.com/" + finalRepoUrl + ".git";
                }
            } else if (userId != null) {
                com.monetique.eye.entity.GitHubToken token = gitHubTokenRepository.findByUserId(userId).orElse(null);
                if (token != null && !finalRepoUrl.startsWith("http")) {
                    finalRepoUrl = "https://" + token.getAccessToken() + "@github.com/" + finalRepoUrl + ".git";
                }
            }

            // Execute Application Playbook
            List<String> commandList = new ArrayList<>(List.of(
                    "ansible-playbook",
                    "-i", inventoryPath,
                    playbookPath,
                    "--limit", request.getTargetNode(),
                    "-e", "appName='" + request.getName() + "'",
                    "-e", "target_host=" + request.getTargetNode(),
                    "-e", "repoUrl='" + finalRepoUrl + "'",
                    "-e", "branch='" + request.getBranch() + "'",
                    "-e", "appPort=" + hostPort,
                    "-e", "appType=" + request.getType(),
                    "-e", "appLanguage='" + (request.getAppLanguage() != null ? request.getAppLanguage() : "") + "'",
                    "-e",
                    "autoGenerateConfig="
                            + (request.getAutoGenerateConfig() != null && request.getAutoGenerateConfig() ? "true"
                                    : "false"),
                    "-e", "dockerBuildArgs='" + buildArgsStr + "'",
                    "-e", "envLabel='" + environment.getSafeName() + "'",
                    "-e", "nodename='" + nodeName + "'",
                    "-e", "srcPath='" + (request.getSrcPath() != null ? request.getSrcPath() : ".") + "'",
                    "-e", "oldAppName='" + oldAppName + "'",
                    "-e", "isCanary=" + (isCanary ? "true" : "false"),
                    "-e", "appId=" + app.getId(),
                    "-e", "envVarsJson='" + (request.getEnvVars() != null ? objectMapper.writeValueAsString(request.getEnvVars()) : "{}") + "'",
                    "-e", "containerPort=" + (request.getContainerPort() != null ? request.getContainerPort()
                            : ("FRONTEND".equalsIgnoreCase(request.getType()) ? 80 : request.getPort()))));

//            // GitHub Integration Vars (Smart Auto-Link)
//            String githubInstallationId = app.getGithubInstallationId();
//            String githubRepoFullName = app.getGithubRepoFullName();
//
//            if (githubInstallationId == null || githubInstallationId.isEmpty()) {
//                String owner = extractGithubOwner(app.getRepoUrl());
//                if (owner != null) {
//                    log.info("Attempting to auto-discover GitHub installation for owner: {}", owner);
//                    Optional<Application> sibling = applicationRepository.findFirstByGithubInstallationIdIsNotNullAndRepoUrlContaining("github.com/" + owner + "/");
//                    if (sibling.isPresent()) {
//                        githubInstallationId = sibling.get().getGithubInstallationId();
//                        log.info("Auto-discovered installation ID: {} from sibling application: {}", githubInstallationId, sibling.get().getName());
//                        // If we don't have a repo full name yet, use the current repo info but the shared installation
//                        if (githubRepoFullName == null || githubRepoFullName.isEmpty()) {
//                            githubRepoFullName = extractGithubRepoFullName(app.getRepoUrl());
//                        }
//                    }
//                }
//            }
//
//            if (githubInstallationId != null && !githubInstallationId.isEmpty()) {
//                commandList.add("-e");
//                commandList.add("githubInstallationId=" + githubInstallationId);
//                commandList.add("-e");
//                commandList.add("githubRepoFullName=" + (githubRepoFullName != null ? githubRepoFullName : ""));
//                commandList.add("-e");
//                commandList.add("applicationId=" + app.getId());
//            }

            // Conditionally add Ansible coordinates
            if (sshUser != null && !sshUser.isEmpty()) {
                commandList.add("-e");
                commandList.add("ansible_user=" + sshUser);
            }

            if (sshPass != null && !sshPass.isEmpty()) {
                commandList.add("-e");
                commandList.add("ansible_ssh_pass=" + sshPass);
                executeProcessSecure(commandList.toArray(new String[0]), deploymentLog, 600);
            } else {
                executeProcess(commandList.toArray(new String[0]), deploymentLog, 600);
            }

            deploymentLog.setStatus("SUCCESS");

            // Task 2: Update application status and canary tracking
            app.setStatus("RUNNING");
            app.setIsCanary(isCanary);
            app.setCanaryPort(isCanary ? hostPort : null);
            app.setLastDeployedAt(java.time.LocalDateTime.now());
            applicationRepository.save(app);

            // Auto-Promotion Stage 2
            if (request.getAutoPromote() != null && request.getAutoPromote()) {
                log.info("Auto-Promotion Stage 1 (Canary) successful for {}. Triggering Stage 2 (Promotion) to Stable...", request.getName());
                this.promoteApplication(environmentId, applicationId, userId);
            }



        } catch (Exception e) {
            log.error("Application full deployment failed: {}", e.getMessage());
            deploymentLog.setStatus("FAILED");
            String fullLog = (deploymentLog.getLogOutput() == null ? "" : deploymentLog.getLogOutput())
                    + "\nERROR: " + e.getMessage();
            deploymentLog.setLogOutput(fullLog);

            // Extract concise error for the user
            String simpleError = extractSimpleErrorMessage(fullLog);
            deploymentLog.setShortError(simpleError);

            // Update application status and store the error summary
            app.setStatus("FAILED");
            app.setLastErrorMessage(simpleError);
            applicationRepository.save(app);
            log.info("Deployment failed for application: {}. Error: {}", app.getName(), simpleError);
        } finally {
            deploymentLogRepository.save(deploymentLog);
        }
    }

    private String getCentralIp(Environment environment) {
        // 1. Try finding central-node in the current environment
        return managedNodeRepository.findByEnvironmentAndNodeName(environment, "central-node")
                .map(com.monetique.eye.entity.ManagedNode::getIp)
                // 2. Fallback to searching globally for any node named central-node
                .or(() -> managedNodeRepository.findAll().stream()
                        .filter(n -> "central-node".equalsIgnoreCase(n.getNodeName()))
                        .map(com.monetique.eye.entity.ManagedNode::getIp)
                        .findFirst())
                // 3. Fallback to the environment's configured central node IP
                .orElseGet(() -> environment.getCentralNodeIp());
    }

    public void updateInventory(String envName, String targetIp, String sshUser) {
        envName = getSafeGroupName(envName);
        log.info("Updating Ansible inventory for env group: {}, host: {}, User: {}", envName, targetIp, sshUser);
        try {
            File inventoryFile = new File(gitopsPath + "/ansible/inventory.ini");
            inventoryFile.getParentFile().mkdirs();

            List<String> lines = inventoryFile.exists()
                    ? Files.readAllLines(inventoryFile.toPath())
                    : new ArrayList<>();

            // 0. Proactively remove any "bad" headers (containing spaces) that break Ansible
            lines.removeIf(line -> {
                String trimmed = line.trim();
                if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                    String groupName = trimmed.substring(1, trimmed.length() - 1);
                    return groupName.contains(" ");
                }
                return false;
            });

            // 1. Ensure [agents:children] group exists at the top
            int childrenIdx = -1;
            for (int i = 0; i < lines.size(); i++) {
                if (lines.get(i).trim().equals("[agents:children]")) {
                    childrenIdx = i;
                    break;
                }
            }
            if (childrenIdx == -1) {
                if (!lines.isEmpty() && lines.get(0).trim().equals("[agents]")) {
                    lines.set(0, "[agents:children]");
                } else {
                    lines.add(0, "[agents:children]");
                }
                childrenIdx = 0;
            }

            // 2. Ensure envName is listed under [agents:children]
            boolean envInChildren = false;
            int lastChildIdx = childrenIdx;
            for (int i = childrenIdx + 1; i < lines.size(); i++) {
                String l = lines.get(i).trim();
                if (l.startsWith("["))
                    break; // Next section
                if (l.equals(envName)) {
                    envInChildren = true;
                    break;
                }
                if (!l.isEmpty())
                    lastChildIdx = i;
            }
            if (!envInChildren) {
                lines.add(lastChildIdx + 1, envName);
            }

            // 3. Ensure [envName] header exists
            int envIdx = -1;
            for (int i = 0; i < lines.size(); i++) {
                if (lines.get(i).trim().equals("[" + envName + "]")) {
                    envIdx = i;
                    break;
                }
            }
            if (envIdx == -1) {
                lines.add(""); // Spacer
                lines.add("[" + envName + "]");
                envIdx = lines.size() - 1;
            }

            // 4. Update node entries if IP is provided
            if (targetIp != null && sshUser != null) {
                String ipLine = targetIp + " ansible_user=" + sshUser;
                String aliasLine = sshUser + " ansible_host=" + targetIp + " ansible_user=" + sshUser;

                // DEEP CLEAN: Remove ANY line that could cause a collision
                lines.removeIf(line -> {
                    String trimmed = line.trim();
                    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                        // Don't remove the header we just ensured exists
                        return false;
                    }

                    // Kill lines starting with the SSH User (your preferred alias) to ensure it's
                    // fresh
                    if (trimmed.startsWith(sshUser + " "))
                        return true;
                    if (trimmed.equals(sshUser))
                        return true;

                    // Kill lines containing the target IP or mentions of the old alias style
                    return trimmed.startsWith(targetIp + " ") ||
                            trimmed.equals(targetIp) ||
                            trimmed.startsWith("agent-" + targetIp.replace(".", "-")) ||
                            trimmed.contains("ansible_host=" + targetIp);
                });

                // Find env header again because indices might have changed after removal
                envIdx = -1;
                for (int i = 0; i < lines.size(); i++) {
                    if (lines.get(i).trim().equals("[" + envName + "]")) {
                        envIdx = i;
                        break;
                    }
                }

                // Add new entries under the correct header
                lines.add(envIdx + 1, ipLine);
                lines.add(envIdx + 2, aliasLine);
            }

            Files.write(inventoryFile.toPath(), lines);
            log.info("Inventory successfully deep-cleaned and restructured for env: {}", envName);
        } catch (Exception e) {
            log.error("Failed to update inventory: {}", e.getMessage(), e);
        }
    }

    public void removeEnvironmentFromInventory(String envName) {
        envName = getSafeGroupName(envName);
        log.info("Removing environment group from inventory: {}", envName);
        try {
            File inventoryFile = new File(gitopsPath + "/ansible/inventory.ini");
            if (!inventoryFile.exists())
                return;

            List<String> lines = Files.readAllLines(inventoryFile.toPath());
            
            // Proactively remove any "bad" headers (containing spaces)
            lines.removeIf(line -> {
                String trimmed = line.trim();
                if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                    String groupName = trimmed.substring(1, trimmed.length() - 1);
                    return groupName.contains(" ");
                }
                return false;
            });

            List<String> newLines = new ArrayList<>();
            boolean inTargetSection = false;

            for (String line : lines) {
                String trimmed = line.trim();

                // 1. Skip the group name if it's under [agents:children]
                if (!inTargetSection && trimmed.equals(envName)) {
                    continue;
                }

                // 2. Detect start of target section
                if (trimmed.equals("[" + envName + "]")) {
                    inTargetSection = true;
                    continue;
                }

                // 3. Detect end of target section (next header)
                if (inTargetSection && trimmed.startsWith("[") && trimmed.endsWith("]")) {
                    inTargetSection = false;
                }

                // 4. If not in target section, keep the line
                if (!inTargetSection) {
                    newLines.add(line);
                }
            }

            Files.write(inventoryFile.toPath(), newLines);
            log.info("Environment {} removed from inventory successfully.", envName);
        } catch (Exception e) {
            log.error("Failed to remove environment from inventory: {}", e.getMessage(), e);
        }
    }

    private void removeFromInventory(String targetIp) {
        log.info("Removing {} from inventory", targetIp);
        try {
            File inventoryFile = new File(gitopsPath + "/ansible/inventory.ini");
            if (!inventoryFile.exists())
                return;

            List<String> lines = Files.readAllLines(inventoryFile.toPath());
            String safeAlias = "agent-" + targetIp.replace(".", "-");

            lines.removeIf(line -> {
                String trimmed = line.trim();
                if (trimmed.startsWith("[") && trimmed.endsWith("]"))
                    return false;
                // Aggressively remove anything pointing to this IP
                return trimmed.startsWith(targetIp + " ") ||
                        trimmed.equals(targetIp) ||
                        trimmed.startsWith(safeAlias + " ") ||
                        trimmed.contains("ansible_host=" + targetIp);
            });

            Files.write(inventoryFile.toPath(), lines);
            log.info("Inventory cleaned for {}", targetIp);
        } catch (Exception e) {
            log.error("Failed to remove from inventory: {}", e.getMessage(), e);
        }
    }

    @Async
    public void registerNodeInPrometheus(Environment environment, String ip, Long nodeId) {
        log.info("Registering node {} in Prometheus for environment {}", ip, environment.getName());
        try {
            String rawLabel = environment.getPrometheusLabel();
            String envLabel = (rawLabel != null && rawLabel.contains("="))
                    ? rawLabel.substring(rawLabel.indexOf('=') + 1)
                    : rawLabel;
            if (envLabel == null || envLabel.isEmpty()) {
                envLabel = environment.getSafeName();
            }
            String cleanIp = ip != null ? ip.replaceAll("^https?://", "").replaceAll("/$", "") : "";
            String centralIp = getCentralIp(environment);
            String nodeName = cleanIp.equals(centralIp) ? "central-node" : "node-" + cleanIp.replace(".", "-");

            // 1. Update agent_targets.yml (Metrics)
            updateTargetFile(
                new File(gitopsPath + "/vmpipe/prometheus/file_sd/agent_targets.yml"),
                generateMetricsTargets(cleanIp, centralIp, envLabel, nodeName, nodeId)
            );

            // 2. Update blackbox_targets.yml (Probes)
            updateTargetFile(
                new File(gitopsPath + "/vmpipe/prometheus/file_sd/blackbox_targets.yml"),
                generateBlackboxTargets(cleanIp, centralIp, envLabel, nodeName)
            );

            log.info("Updated Prometheus targets for node {}", cleanIp);
            triggerPrometheusReload();

        } catch (Exception e) {
            log.error("Failed to register node in Prometheus: {}", e.getMessage(), e);
        }
    }

    private void updateTargetFile(File configFile, List<Map<String, Object>> newItems) throws IOException {
        configFile.getParentFile().mkdirs();
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper(
                new com.fasterxml.jackson.dataformat.yaml.YAMLFactory());
        
        List<Map<String, Object>> targets = new ArrayList<>();
        if (configFile.exists() && configFile.length() > 0) {
            targets = mapper.readValue(configFile,
                    new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
        }

        for (Map<String, Object> newItem : newItems) {
            updateOrAdd(targets, newItem);
        }

        mapper.writeValue(configFile, targets);
    }

    private List<Map<String, Object>> generateMetricsTargets(String ip, String centralIp, String envLabel, String nodeName, Long nodeId) {
        List<Map<String, Object>> list = new ArrayList<>();
        
        Integer nodeExporterPort = 9100;
        Integer cadvisorPort = 8085;
        com.monetique.eye.entity.ManagedNode node = managedNodeRepository.findById(nodeId).orElse(null);
        if (node != null) {
            if (node.getNodeExporterPort() != null) nodeExporterPort = node.getNodeExporterPort();
            if (node.getCadvisorPort() != null) cadvisorPort = node.getCadvisorPort();
        }

        String nodeExporterTarget = ip + ":" + nodeExporterPort;
        String cadvisorTarget = ip + ":" + cadvisorPort;
        String filebeatTarget = ip + ":5066";
        String backendTarget = ip + ":8880";
        String frontendTarget = ip + ":80";

        if (ip.equals(centralIp)) {
            nodeExporterTarget = "node-exporter:9100";
            cadvisorTarget = "cadvisor:8080";
            filebeatTarget = "filebeat:5066";
            backendTarget = "backend:8880";
            frontendTarget = "frontend:80";
        }

        list.add(createTarget(nodeExporterTarget, Map.of("job", "node-exporter", "environment", envLabel, "nodename", nodeName, "node_id", String.valueOf(nodeId))));
        list.add(createTarget(cadvisorTarget, Map.of("job", "cadvisor", "environment", envLabel, "nodename", nodeName, "node_id", String.valueOf(nodeId))));
        list.add(createTarget(filebeatTarget, Map.of("job", "filebeat", "environment", envLabel, "nodename", nodeName, "node_id", String.valueOf(nodeId))));
        list.add(createTarget(backendTarget, Map.of("job", "monetique-backend", "environment", envLabel, "nodename", nodeName, "node_id", String.valueOf(nodeId))));
        list.add(createTarget(frontendTarget, Map.of("job", "monetique-frontend", "environment", envLabel, "nodename", nodeName, "node_id", String.valueOf(nodeId))));
        
        return list;
    }

    private List<Map<String, Object>> generateBlackboxTargets(String ip, String centralIp, String envLabel, String nodeName) {
        List<Map<String, Object>> list = new ArrayList<>();
        
        // 1. Node Health (ICMP)
        String nodeTarget = ip;
        String nodeModule = "icmp";
        if (ip.equals(centralIp)) {
            nodeTarget = "http://backend:8880/actuator/health";
            nodeModule = "http_2xx";
        }
        list.add(createTarget(nodeTarget, Map.of("job", "blackbox", "environment", envLabel, "nodename", nodeName, "probe_module", nodeModule, "target_type", "node")));

        // 2. Frontend Health (HTTP)
        String frontendTarget = "http://" + (ip.equals(centralIp) ? "frontend" : ip) + ":80";
        list.add(createTarget(frontendTarget, Map.of("job", "blackbox", "environment", envLabel, "nodename", nodeName, "probe_module", "http_2xx", "target_type", "frontend")));
        
        return list;
    }

    private Map<String, Object> createTarget(String target, Map<String, String> labels) {
        Map<String, Object> map = new HashMap<>();
        map.put("targets", List.of(target));
        map.put("labels", labels);
        return map;
    }

    @Async


    private void deregisterNodeFromPrometheus(String ip) {
        log.info("Deregistering node {} from Prometheus", ip);
        try {
            deregisterFromFile(new File(gitopsPath + "/vmpipe/prometheus/file_sd/agent_targets.yml"), ip);
            deregisterFromFile(new File(gitopsPath + "/vmpipe/prometheus/file_sd/blackbox_targets.yml"), ip);
            
            triggerPrometheusReload();
        } catch (Exception e) {
            log.error("Failed to deregister node from Prometheus: {}", e.getMessage(), e);
        }
    }

    private void deregisterFromFile(File configFile, String ip) throws IOException {
        if (!configFile.exists()) return;

        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper(
                new com.fasterxml.jackson.dataformat.yaml.YAMLFactory());

        List<Map<String, Object>> targets = mapper.readValue(configFile,
                new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});

        boolean removed = targets.removeIf(item -> {
            String targetStr = ((List<String>) item.get("targets")).get(0);
            return targetStr.contains(ip);
        });

        if (removed) {
            mapper.writeValue(configFile, targets);
            log.info("Updated file {} after removing {}", configFile.getName(), ip);
        }
    }

    private void updateOrAdd(java.util.List<java.util.Map<String, Object>> list,
            java.util.Map<String, Object> newItem) {
        String newTarget = ((java.util.List<String>) newItem.get("targets")).get(0);
        String newJob = ((java.util.Map<String, String>) newItem.get("labels")).get("job");

        list.removeIf(item -> {
            String target = ((java.util.List<String>) item.get("targets")).get(0);
            String job = ((java.util.Map<String, String>) item.get("labels")).get("job");
            return target.equals(newTarget) && job.equals(newJob);
        });
        list.add(newItem);
    }

    private void triggerPrometheusReload() {
        try {
            log.info("Triggering Prometheus reload...");
            java.net.http.HttpClient client = java.net.http.HttpClient.newBuilder()
                    .connectTimeout(java.time.Duration.ofSeconds(2))
                    .build();
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create("http://prometheus:9090/-/reload"))
                    .timeout(java.time.Duration.ofSeconds(3))
                    .POST(java.net.http.HttpRequest.BodyPublishers.noBody())
                    .build();
            client.send(request, java.net.http.HttpResponse.BodyHandlers.discarding());
            log.info("Prometheus reload triggered successfully.");
        } catch (Exception e) {
            log.error("Failed to reload Prometheus: {}", e.getMessage());
        }
    }

    private void executeProcess(String[] command, DeploymentLog logEntry, int timeoutSeconds) throws Exception {
        executeProcessInternal(command, logEntry, timeoutSeconds, false);
    }

    private void executeProcessSecure(String[] command, DeploymentLog logEntry, int timeoutSeconds) throws Exception {
        executeProcessInternal(command, logEntry, timeoutSeconds, true);
    }

    private void executeProcessInternal(String[] command, DeploymentLog logEntry, int timeoutSeconds,
            boolean maskLastArg) throws Exception {
        String cmdStr = String.join(" ", command);
        if (maskLastArg && command.length > 0) {
            String[] masked = command.clone();
            masked[masked.length - 1] = "********";
            cmdStr = String.join(" ", masked);
        }

        log.info("Executing command: {}", cmdStr);
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(new File(gitopsPath));

        // Robust environment for bypassing strict host key checking
        pb.environment().put("ANSIBLE_HOST_KEY_CHECKING", "False");
        pb.environment().put("ANSIBLE_CONFIG", gitopsPath + "/ansible/ansible.cfg");
        pb.environment().put("ANSIBLE_SSH_ARGS", "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null");
        pb.environment().put("ANSIBLE_SSH_PIPELINING", "True");
        pb.redirectErrorStream(true);

        Process process = pb.start();
        StringBuilder output = new StringBuilder();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
        }

        boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            throw new RuntimeException("Process timed out after " + timeoutSeconds + " seconds");
        }

        if (logEntry != null) {
            String currentLog = logEntry.getLogOutput() == null ? "" : logEntry.getLogOutput();
            logEntry.setLogOutput(currentLog + "\n\n--- COMMAND: " + cmdStr + " ---\n" + output.toString());
        }

        if (output.toString().contains("Could not match supplied host pattern") || 
            output.toString().contains("provided hosts list is empty")) {
            throw new RuntimeException("Ansible failed: No target hosts matched the inventory. Ensure the target IP is correctly configured and accessible.");
        }

        if (process.exitValue() != 0) {
            throw new RuntimeException("Process exited with code " + process.exitValue());
        }
    }

    @Async
    @Transactional
    public void promoteApplication(Long environmentId, Long applicationId, String userId) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new RuntimeException("Application not found: " + applicationId));

        // Create a fake DeployRequestDTO from existing app data
        com.monetique.eye.dto.DeployRequestDTO request = new com.monetique.eye.dto.DeployRequestDTO();
        request.setName(app.getName());
        request.setType(app.getType());
        request.setAppLanguage(app.getAppLanguage());
        request.setRepoUrl(app.getRepoUrl());
        request.setBranch(app.getBranch());
        request.setTargetNode(app.getTargetNode());
        request.setPort(app.getPort());
        request.setSrcPath(app.getSrcPath());
        request.setContainerPort(app.getContainerPort());
        request.setCanary(false); // Promotion!
        request.setAutoPromote(false); // Ensure no loops
        request.setAutoGenerateConfig(true);

        // Map env vars if possible (currently not persistent in DB, but we could add them if needed)
        // For now, we assume promotion uses the last configuration.

        deployApplicationFull(environmentId, request, applicationId, app.getName(), userId, false);
    }

    /**
     * Parses the technical Ansible log to extract a concise, user-friendly error message.
     */
    private String extractSimpleErrorMessage(String fullLog) {
        if (fullLog == null || fullLog.isEmpty()) return "Unknown deployment error";

        // 1. Check for unreachable host
        if (fullLog.contains("UNREACHABLE!")) {
            return "Host Unreachable: Could not connect to the target node via SSH.";
        }

        // 2. Check for port allocation conflicts
        if (fullLog.contains("port is already allocated")) {
            return "Port Conflict: The requested port is already in use by another service on this node.";
        }

        // 3. Check for specific Ansible FAILED! messages
        if (fullLog.contains("FAILED!")) {
            // Try to find the "msg" field in the JSON output near the failure
            int idx = fullLog.lastIndexOf("\"msg\": \"");
            if (idx != -1) {
                int start = idx + 8;
                int end = fullLog.indexOf("\"", start);
                if (end != -1) {
                    return "Deployment Failed: " + fullLog.substring(start, end);
                }
            }
            return "Deployment Failed: A task in the playbook failed. Check logs for details.";
        }
        
        // 4. Check for Permission denied or sudoers issue
        if (fullLog.contains("n'apparaît pas dans le fichier sudoers") || fullLog.contains("is not in the sudoers file")) {
            return "Privilege Error: The deployment user does not have sudo permissions on the target node.";
        }
        
        if (fullLog.contains("Permission denied")) {
            return "Access Denied: Invalid SSH credentials or insufficient permissions on the node.";
        }

        // 5. Check for No hosts matched
        if (fullLog.contains("No target hosts matched the inventory")) {
            return "Infrastructure Error: The target IP was not found in the Ansible inventory or could not be matched. Ensure the node is correctly added to the environment.";
        }

        // 6. Generic Exception message
        if (fullLog.contains("ERROR: ")) {
            int idx = fullLog.lastIndexOf("ERROR: ");
            return "Internal Error: " + fullLog.substring(idx + 7).split("\n")[0];
        }

        return "Deployment failed during the execution phase. Surface technical logs for more info.";
    }

    private String extractGithubOwner(String url) {
        if (url == null || !url.contains("github.com/")) return null;
        try {
            String path = url.split("github.com/")[1];
            return path.split("/")[0];
        } catch (Exception e) {
            return null;
        }
    }

    private String extractGithubRepoFullName(String url) {
        if (url == null || !url.contains("github.com/")) return null;
        try {
            String path = url.split("github.com/")[1].replace(".git", "");
            String[] parts = path.split("/");
            if (parts.length >= 2) {
                return parts[0] + "/" + parts[1];
            }
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    public boolean isApplicationRunning(String targetIp, String appName, String port) {
        log.info("Checking if application {} or port {} is running on {}", appName, port, targetIp);
        try {
            String inventoryPath = gitopsPath + "/ansible/inventory.ini";
            
            Optional<com.monetique.eye.entity.ManagedNode> nodeOpt = managedNodeRepository.findAll().stream()
                .filter(n -> n.getIp().equals(targetIp))
                .findFirst();
            
            String sshPass = nodeOpt.map(com.monetique.eye.entity.ManagedNode::getSshPassword).orElse("");
            String sshUser = nodeOpt.map(com.monetique.eye.entity.ManagedNode::getSshUser).orElse("root");

            // Normalize app name for regex (replace spaces with potential separators)
            String appPattern = appName.trim().replaceAll("\\s+", "[-_ ]");
            
            // Check Command:
            // 1. Docker ps matching name
            // 2. netstat check for port
            // 3. ss check for port
            String checkCommand = String.format(
                "docker ps --filter status=running | grep -iE '%s' || netstat -tuln | grep ':%s' || ss -tuln | grep ':%s'", 
                appPattern, port, port
            );

            ProcessBuilder pb = new ProcessBuilder(
                "ansible", "all", "-i", inventoryPath, "--limit", targetIp,
                "-m", "shell", "-a", checkCommand,
                "-e", "ansible_ssh_pass=" + sshPass,
                "-e", "ansible_become_pass=" + sshPass,
                "-e", "ansible_user=" + sshUser
            );
            
            pb.environment().put("ANSIBLE_HOST_KEY_CHECKING", "False");
            pb.directory(new File(gitopsPath));
            pb.redirectErrorStream(true);
            
            Process process = pb.start();
            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
            }
            process.waitFor(25, TimeUnit.SECONDS);
            
            String result = output.toString();
            log.info("App check raw output for {}: {}", targetIp, result);
            
            // If the process exit value is 0, it means one of the commands in the chain found a match
            // and Ansible successfully executed it.
            return process.exitValue() == 0 && !result.contains("FAILED") && !result.contains("UNREACHABLE");
        } catch (Exception e) {
            log.error("Failed to check if app is running: {}", e.getMessage());
            return false;
        }
    }

    @Async
    public void restartContainer(String targetNodeIp, String containerName) {
        log.info("Restarting container {} on node {}", containerName, targetNodeIp);
        try {
            String inventoryPath = gitopsPath + "/ansible/inventory.ini";
            
            Optional<com.monetique.eye.entity.ManagedNode> nodeOpt = managedNodeRepository.findAll().stream()
                .filter(n -> n.getIp().equals(targetNodeIp))
                .findFirst();
            
            String sshPass = nodeOpt.map(com.monetique.eye.entity.ManagedNode::getSshPassword).orElse("");
            String sshUser = nodeOpt.map(com.monetique.eye.entity.ManagedNode::getSshUser).orElse("root");

            executeProcessSecure(new String[] {
                    "ansible", "all", "-i", inventoryPath, "--limit", targetNodeIp,
                    "-m", "shell", "-a", "docker restart " + containerName,
                    "-b",
                    "-e", "ansible_become_pass=" + sshPass,
                    "-e", "ansible_ssh_pass=" + sshPass,
                    "-e", "ansible_user=" + sshUser
            }, null, 60); 
            log.info("Container {} restarted successfully on {}", containerName, targetNodeIp);
        } catch (Exception e) {
            log.error("Failed to restart container {}: {}", containerName, e.getMessage());
        }
    }

    @Async
    @Transactional
    public void syncMonitoring() {
        log.info("Starting global monitoring synchronization...");
        List<com.monetique.eye.entity.ManagedNode> nodes = managedNodeRepository.findAll();
        for (com.monetique.eye.entity.ManagedNode node : nodes) {
            registerNodeInPrometheus(node.getEnvironment(), node.getIp(), node.getId());
        }

        log.info("Global monitoring synchronization complete.");
    }
}
