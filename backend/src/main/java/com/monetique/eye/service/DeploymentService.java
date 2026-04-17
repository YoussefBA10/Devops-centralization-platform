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
            updateInventory(sshUser, targetIp, sshUser);

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

            executeProcess(new String[] {
                    "ansible-playbook",
                    "-i", inventoryPath,
                    playbookPath,
                    "-e", "env_label=" + envLabel,
                    "-e", "ansible_user=" + sshUser,
                    "-e", "ssh_user=" + sshUser,
                    "-e", "target_host=" + targetIp,
                    "-e", "central_logstash_ip=" + centralIp
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
    public CompletableFuture<Void> undeployAgentAsync(Environment environment, String targetIp, String sshUser) {
        log.info("Starting undeployment for IP: {} (Environment: {})", targetIp, environment.getName());
        try {
            // 1. Run Ansible Undeploy Playbook
            String playbookPath = gitopsPath + "/ansible/undeploy-node.yml";
            String inventoryPath = gitopsPath + "/ansible/inventory.ini";
            
            // Generate a temporary inventory for just this target to ensure we don't undeploy others accidentally
            File tempInventory = File.createTempFile("undeploy-inventory", ".ini");
            try (FileWriter writer = new FileWriter(tempInventory)) {
                writer.write("[agents]\n" + targetIp + " ansible_user=" + sshUser + "\n");
            }
            
            executeProcess(new String[] {
                    "ansible-playbook",
                    "-i", tempInventory.getAbsolutePath(),
                    playbookPath,
                    "-e", "target_host=" + targetIp,
                    "-e", "ssh_user=" + sshUser
            }, new DeploymentLog(), 300);
            
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
                .status("IN_PROGRESS")
                .logOutput("")
                .build();
        deploymentLog = deploymentLogRepository.save(deploymentLog);

        try {
            // 1. Update Inventory
            updateInventory(environment.getName(), targetIp, sshUser);

            // 2. Select Playbook
            String playbookFile = "deploy-backend.yml";
            if (appName.toLowerCase().contains("frontend")) {
                playbookFile = "deploy-frontend.yml";
            }

            String playbookPath = gitopsPath + "/ansible/" + playbookFile;
            String inventoryPath = gitopsPath + "/ansible/inventory.ini";
            String centralIp = environment.getCentralNodeIp() != null ? environment.getCentralNodeIp()
                    : "192.168.126.130";

            // 3. Execute Application Playbook
            executeProcess(new String[] {
                    "ansible-playbook",
                    "-i", inventoryPath,
                    playbookPath,
                    "-e", "appName=" + appName,
                    "-e", "ansible_user=" + sshUser,
                    "-e", "central_ip=" + centralIp
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

    private void updateInventory(String envName, String targetIp, String sshUser) throws Exception {
        String hostAlias = envName.toLowerCase().replaceAll("[^a-z0-9]", "-");
        log.info("Updating Ansible inventory at {}/ansible/inventory.ini with host: {}, User: {}", gitopsPath,
                hostAlias, sshUser);
        File inventoryFile = new File(gitopsPath + "/ansible/inventory.ini");
        inventoryFile.getParentFile().mkdirs();
        try (FileWriter writer = new FileWriter(inventoryFile)) {
            writer.write("[agents]\n" + targetIp + " ansible_user=" + sshUser + "\n");
        }
    }

    private void removeFromInventory(String targetIp) {
        try {
            File inventoryFile = new File(gitopsPath + "/ansible/inventory.ini");
            if (!inventoryFile.exists()) return;
            
            java.util.List<String> lines = java.nio.file.Files.readAllLines(inventoryFile.toPath());
            java.util.List<String> updatedLines = new java.util.ArrayList<>();
            for (String line : lines) {
                if (!line.contains("ansible_host=" + targetIp)) {
                    updatedLines.add(line);
                }
            }
            java.nio.file.Files.write(inventoryFile.toPath(), updatedLines);
            log.info("Removed {} from inventory", targetIp);
        } catch (Exception e) {
            log.error("Failed to remove from inventory: {}", e.getMessage());
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

            // Determine targets based on whether the IP matches the central node
            String nodeExporterTarget = ip + ":9100";
            String cadvisorTarget = ip + ":8081";

            if (ip.equals(environment.getCentralNodeIp())) {
                log.info("Node {} is detected as Central Node. Using internal service names.", ip);
                nodeExporterTarget = "node-exporter:9100";
                cadvisorTarget = "cadvisor:8080";
            }

            // Add Node Exporter target
            java.util.Map<String, Object> nodeExporter = new java.util.HashMap<>();
            nodeExporter.put("targets", java.util.List.of(nodeExporterTarget));
            nodeExporter.put("labels", java.util.Map.of("job", "node-exporter", "environment", envLabel));

            // Add cAdvisor target
            java.util.Map<String, Object> cadvisor = new java.util.HashMap<>();
            cadvisor.put("targets", java.util.List.of(cadvisorTarget));
            cadvisor.put("labels", java.util.Map.of("job", "cadvisor", "environment", envLabel));

            // Add Filebeat target
            String filebeatTarget = ip + ":5066";
            if (ip.equals(environment.getCentralNodeIp())) {
                filebeatTarget = "filebeat:5066";
            }
            java.util.Map<String, Object> filebeat = new java.util.HashMap<>();
            filebeat.put("targets", java.util.List.of(filebeatTarget));
            filebeat.put("labels", java.util.Map.of("job", "filebeat", "environment", envLabel));

            // Check for duplicates and update or add
            updateOrAdd(targets, nodeExporter);
            updateOrAdd(targets, cadvisor);
            updateOrAdd(targets, filebeat);

            mapper.writeValue(configFile, targets);
            log.info("Updated Prometheus targets in {}", configFile.getAbsolutePath());

            // Trigger Prometheus Reload
            triggerPrometheusReload();

        } catch (Exception e) {
            log.error("Failed to register node in Prometheus: {}", e.getMessage(), e);
        }
    }

    private void deregisterNodeFromPrometheus(String ip) {
        log.info("Deregistering node {} from Prometheus", ip);
        try {
            File configFile = new File(gitopsPath + "/vmpipe/prometheus/file_sd/agent_targets.yml");
            if (!configFile.exists()) return;

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
            String errorMsg = "Process exited with code " + process.exitValue() + "\nOutput:\n" + output.toString();
            log.error(errorMsg);
            System.err.println(errorMsg); // Ensure it appears in VM console
            throw new RuntimeException("Process exited with code " + process.exitValue());
        }
    }
}
