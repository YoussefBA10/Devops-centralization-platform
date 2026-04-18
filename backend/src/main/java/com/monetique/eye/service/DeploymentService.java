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

import java.io.BufferedReader;
import java.io.File;
import java.io.FileWriter;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@Service
public class DeploymentService {

    private static final Logger log = LoggerFactory.getLogger(DeploymentService.class);

    private final DeploymentLogRepository deploymentLogRepository;
    private final EnvironmentRepository environmentRepository;
    private final ApplicationRepository applicationRepository;

    @Value("${monetique.gitops.path}")
    private String gitopsPath;

    public DeploymentService(DeploymentLogRepository deploymentLogRepository,
            EnvironmentRepository environmentRepository,
            ApplicationRepository applicationRepository) {
        this.deploymentLogRepository = deploymentLogRepository;
        this.environmentRepository = environmentRepository;
        this.applicationRepository = applicationRepository;
    }

    @Async
    public CompletableFuture<DeploymentLog> deployAgentAsync(Environment environment, String targetIp, String sshUser,
            String sshPassword) {
        log.info("Starting agent deployment for environment: {} at IP: {}", environment.getName(), targetIp);

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

            // 3. Execute Ansible Playbook
            String playbookPath = gitopsPath + "/ansible/deploy-tools.yml";
            String inventoryPath = gitopsPath + "/ansible/inventory.ini";

            String envLabel = environment.getName().toLowerCase().replaceAll("[^a-z0-9]", "-");
            String centralIp = environment.getCentralNodeIp() != null ? environment.getCentralNodeIp()
                    : "192.168.126.130";

            String nodeName = targetIp.equals(environment.getCentralNodeIp()) ? "vmpipe"
                    : "node-" + targetIp.replace(".", "-");

            executeProcess(new String[] {
                    "ansible-playbook",
                    "-i", inventoryPath,
                    playbookPath,
                    "--limit", targetIp,
                    "-e", "env_label=" + envLabel,
                    "-e", "ansible_user=" + sshUser,
                    "-e", "ssh_user=" + sshUser,
                    "-e", "target_host=" + targetIp,
                    "-e", "central_logstash_ip=" + centralIp,
                    "-e", "nodename=" + nodeName
            }, deploymentLog, 600);

            deploymentLog.setStatus("SUCCESS");
            registerNodeInPrometheus(environment, targetIp);
            environment.setLastDeploymentStatus(DeploymentStatus.SUCCESS);
            environment.setLastDeployedAt(java.time.LocalDateTime.now());
            environmentRepository.save(environment);
        } catch (Exception e) {
            log.error("Deployment failed: {}", e.getMessage());
            deploymentLog.setStatus("FAILED");
            environment.setLastDeploymentStatus(DeploymentStatus.FAILED);
            environmentRepository.save(environment);
            deploymentLog.setLogOutput((deploymentLog.getLogOutput() == null ? "" : deploymentLog.getLogOutput())
                    + "\nERROR: " + e.getMessage());
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
            // 1. Run Ansible Undeploy Playbook
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

            // 2. Remove from Prometheus
            deregisterNodeFromPrometheus(targetIp);

            // 3. Remove from main inventory
            removeFromInventory(targetIp);

            log.info("Successfully undeployed agent {}", targetIp);
        } catch (Exception e) {
            log.error("Undeployment failed for {}: {}", targetIp, e.getMessage());
        }
        return CompletableFuture.completedFuture(null);
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
            String centralIp = environment.getCentralNodeIp() != null ? environment.getCentralNodeIp()
                    : "192.168.126.130";

            String nodeName = targetIp.equals(environment.getCentralNodeIp()) ? "vmpipe"
                    : "node-" + targetIp.replace(".", "-");

            // 3. Execute Application Playbook
            executeProcess(new String[] {
                    "ansible-playbook",
                    "-i", inventoryPath,
                    playbookPath,
                    "--limit", targetIp,
                    "-e", "appName=" + appName,
                    "-e", "ansible_user=" + sshUser,
                    "-e", "central_ip=" + centralIp,
                    "-e", "nodename=" + nodeName
            }, deploymentLog, 600);

            deploymentLog.setStatus("SUCCESS");

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
    public void deployApplicationFull(Long environmentId, com.monetique.eye.dto.DeployRequestDTO request,
            Long applicationId) {
        
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
            // Find SSH User from inventory or use a default (like root/ubuntu) for the
            // target IP
            // In a real scenario, this would look up the target node's sshUser from DB or
            // inventory
            // We assume deploy-app.yml playbook will handle connection based on existing
            // inventory structure
            String playbookPath = gitopsPath + "/ansible/deploy-app.yml";
            String inventoryPath = gitopsPath + "/ansible/inventory.ini";

            // Use existing inventory structure for SSH configuration. The node should have
            // been registered
            // correctly by `deployAgentAsync` containing its real ssh user and password
            // references.

            String nodeName = request.getTargetNode().equals(environment.getCentralNodeIp()) ? "vmpipe"
                    : "node-" + request.getTargetNode().replace(".", "-");

            String buildArgsStr = "";
            if (request.getEnvVars() != null && !request.getEnvVars().isEmpty()) {
                buildArgsStr = request.getEnvVars().entrySet().stream()
                        .map(e -> "--build-arg " + e.getKey() + "=\"" + e.getValue() + "\"")
                        .reduce("", (a, b) -> a + " " + b).trim();
            }

            // Execute Application Playbook
            // The playbook takes parameters: appName, repoUrl, branch, target_host,
            // appPort, appType, envLabel, nodename
            List<String> commandList = new ArrayList<>(List.of(
                    "ansible-playbook",
                    "-i", inventoryPath,
                    playbookPath,
                    "--limit", request.getTargetNode(),
                    "-e", "appName=" + request.getName(),
                    "-e", "target_host=" + request.getTargetNode(),
                    "-e", "repoUrl=" + request.getRepoUrl(),
                    "-e", "branch=" + request.getBranch(),
                    "-e", "appPort=" + request.getPort(),
                    "-e", "appType=" + request.getType(),
                    "-e", "appLanguage=" + (request.getAppLanguage() != null ? request.getAppLanguage() : ""),
                    "-e", "autoGenerateConfig=" + (request.getAutoGenerateConfig() != null && request.getAutoGenerateConfig() ? "true" : "false"),
                    "-e", "dockerBuildArgs='" + buildArgsStr + "'",
                    "-e", "envLabel=" + environment.getName().toLowerCase().replaceAll("[^a-z0-9]", "-"),
                    "-e", "nodename=" + nodeName,
                    "-e", "srcPath=" + (request.getSrcPath() != null ? request.getSrcPath() : "."),
                    "-e", "containerPort=" + (request.getContainerPort() != null ? request.getContainerPort() : ("FRONTEND".equalsIgnoreCase(request.getType()) ? 80 : request.getPort()))
            ));

            if (request.getSshPassword() != null && !request.getSshPassword().isEmpty()) {
                commandList.add("-e");
                commandList.add("ansible_ssh_pass=" + request.getSshPassword());
                executeProcessSecure(commandList.toArray(new String[0]), deploymentLog, 600); // 10 minutes timeout for
                                                                                              // builds
            } else {
                executeProcess(commandList.toArray(new String[0]), deploymentLog, 600);
            }

            deploymentLog.setStatus("SUCCESS");

            // Update application status
            app.setStatus("RUNNING");
            app.setLastDeployedAt(java.time.LocalDateTime.now());
            applicationRepository.save(app);

        } catch (Exception e) {
            log.error("Application full deployment failed: {}", e.getMessage());
            deploymentLog.setStatus("FAILED");
            deploymentLog.setLogOutput((deploymentLog.getLogOutput() == null ? "" : deploymentLog.getLogOutput())
                    + "\nERROR: " + e.getMessage());

            // Update application status
            app.setStatus("FAILED");
            applicationRepository.save(app);
        } finally {
            deploymentLogRepository.save(deploymentLog);
        }
    }

    public void updateInventory(String envName, String targetIp, String sshUser) {
        log.info("Updating Ansible inventory for env group: {}, host: {}, User: {}", envName, targetIp, sshUser);
        try {
            File inventoryFile = new File(gitopsPath + "/ansible/inventory.ini");
            inventoryFile.getParentFile().mkdirs();

            List<String> lines = inventoryFile.exists()
                    ? Files.readAllLines(inventoryFile.toPath())
                    : new ArrayList<>();

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
        log.info("Removing environment group from inventory: {}", envName);
        try {
            File inventoryFile = new File(gitopsPath + "/ansible/inventory.ini");
            if (!inventoryFile.exists())
                return;

            List<String> lines = Files.readAllLines(inventoryFile.toPath());
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
    public void registerNodeInPrometheus(Environment environment, String ip) {
        log.info("Registering node {} in Prometheus for environment {}", ip, environment.getName());
        try {
            File configFile = new File(gitopsPath + "/vmpipe/prometheus/file_sd/agent_targets.yml");
            configFile.getParentFile().mkdirs();

            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper(
                    new com.fasterxml.jackson.dataformat.yaml.YAMLFactory());
            java.util.List<java.util.Map<String, Object>> targets;

            if (configFile.exists() && configFile.length() > 0) {
                targets = mapper.readValue(configFile,
                        new com.fasterxml.jackson.core.type.TypeReference<java.util.List<java.util.Map<String, Object>>>() {
                        });
            } else {
                targets = new java.util.ArrayList<>();
            }

            String envLabel = environment.getName().toLowerCase().replace(" ", "-");
            String nodeName = ip.equals(environment.getCentralNodeIp()) ? "vmpipe" : "node-" + ip.replace(".", "-");

            // Determine targets based on whether the IP matches the central node
            String nodeExporterTarget = ip + ":9100";
            String cadvisorTarget = ip + ":8081";
            String filebeatTarget = ip + ":5066";

            if (ip.equals(environment.getCentralNodeIp())) {
                log.info("Node {} is detected as Central Node. Using internal service names.", ip);
                nodeExporterTarget = "node-exporter:9100";
                cadvisorTarget = "cadvisor:8080";
                filebeatTarget = "filebeat:5066";
            }

            // Add Node Exporter target
            java.util.Map<String, Object> nodeExporter = new java.util.HashMap<>();
            nodeExporter.put("targets", java.util.List.of(nodeExporterTarget));
            nodeExporter.put("labels",
                    java.util.Map.of("job", "node-exporter", "environment", envLabel, "nodename", nodeName));

            // Add cAdvisor target
            java.util.Map<String, Object> cadvisor = new java.util.HashMap<>();
            cadvisor.put("targets", java.util.List.of(cadvisorTarget));
            cadvisor.put("labels", java.util.Map.of("job", "cadvisor", "environment", envLabel, "nodename", nodeName));

            // Add Filebeat target
            java.util.Map<String, Object> filebeat = new java.util.HashMap<>();
            filebeat.put("targets", java.util.List.of(filebeatTarget));
            filebeat.put("labels", java.util.Map.of("job", "filebeat", "environment", envLabel, "nodename", nodeName));

            // Check for duplicates and update or add
            updateOrAdd(targets, nodeExporter);
            updateOrAdd(targets, cadvisor);
            updateOrAdd(targets, filebeat);

            mapper.writeValue(configFile, targets);
            log.info("Updated Prometheus targets in {}", configFile.getAbsolutePath());

            triggerPrometheusReload();

        } catch (Exception e) {
            log.error("Failed to register node in Prometheus: {}", e.getMessage(), e);
        }
    }

    private void deregisterNodeFromPrometheus(String ip) {
        log.info("Deregistering node {} from Prometheus", ip);
        try {
            File configFile = new File(gitopsPath + "/vmpipe/prometheus/file_sd/agent_targets.yml");
            if (!configFile.exists())
                return;

            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper(
                    new com.fasterxml.jackson.dataformat.yaml.YAMLFactory());

            java.util.List<java.util.Map<String, Object>> targets = mapper.readValue(configFile,
                    new com.fasterxml.jackson.core.type.TypeReference<java.util.List<java.util.Map<String, Object>>>() {
                    });

            boolean removed = targets.removeIf(item -> {
                String targetStr = ((java.util.List<String>) item.get("targets")).get(0);
                return targetStr.startsWith(ip + ":");
            });

            if (removed) {
                mapper.writeValue(configFile, targets);
                log.info("Removed Prometheus targets for {} and updated file", ip);
                triggerPrometheusReload();
            }

        } catch (Exception e) {
            log.error("Failed to deregister node from Prometheus: {}", e.getMessage(), e);
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
            java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create("http://prometheus:9090/-/reload"))
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

        String currentLog = logEntry.getLogOutput() == null ? "" : logEntry.getLogOutput();
        logEntry.setLogOutput(currentLog + "\n\n--- COMMAND: " + cmdStr + " ---\n" + output.toString());

        if (process.exitValue() != 0) {
            throw new RuntimeException("Process exited with code " + process.exitValue());
        }
    }
}
