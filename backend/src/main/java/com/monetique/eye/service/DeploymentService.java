package com.monetique.eye.service;

import com.monetique.eye.entity.DeploymentLog;
import com.monetique.eye.entity.Environment;
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
import java.util.concurrent.TimeUnit;

@Service
public class DeploymentService {

    private static final Logger log = LoggerFactory.getLogger(DeploymentService.class);

    private final DeploymentLogRepository deploymentLogRepository;
    private final EnvironmentRepository environmentRepository;

    @Value("${monetique.gitops.path:../gitops}")
    private String gitopsPath;

    public DeploymentService(DeploymentLogRepository deploymentLogRepository, 
                             EnvironmentRepository environmentRepository) {
        this.deploymentLogRepository = deploymentLogRepository;
        this.environmentRepository = environmentRepository;
    }

    @Async
    public CompletableFuture<DeploymentLog> deployAgentAsync(Environment environment, String targetIp, String sshUser, String sshPassword) {
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
            executeProcess(new String[]{"chmod", "+x", gitopsPath + "/scripts/ssh-configure.sh"}, deploymentLog, 30);

            // 1. Update Inventory
            updateInventory(targetIp);

            // 2. Execute SSH Configure Script (Accepts USER, IP, PASSWORD)
            executeProcessSecure(new String[]{gitopsPath + "/scripts/ssh-configure.sh", sshUser, targetIp, sshPassword}, deploymentLog, 300);

            // 3. Execute Ansible Playbook
            String playbookPath = gitopsPath + "/ansible/deploy-tools.yml";
            String inventoryPath = gitopsPath + "/ansible/inventory.ini";
            executeProcess(new String[]{
                "ansible-playbook", 
                "-i", inventoryPath, 
                playbookPath, 
                "-e", "env_label=" + environment.getName().toLowerCase().replace(" ", "-"),
                "-e", "ansible_user=" + sshUser
            }, deploymentLog, 600);

            deploymentLog.setStatus("SUCCESS");
        } catch (Exception e) {
            log.error("Deployment failed: {}", e.getMessage());
            deploymentLog.setStatus("FAILED");
            deploymentLog.setLogOutput((deploymentLog.getLogOutput() == null ? "" : deploymentLog.getLogOutput()) + "\nERROR: " + e.getMessage());
        } finally {
            deploymentLogRepository.save(deploymentLog);
        }
        return CompletableFuture.completedFuture(deploymentLog);
    }

    @Async
    public void deployApplication(Environment environment, String targetIp, String sshUser, String appName) {
        log.info("Starting application deployment for environment: {} at IP: {}, App: {}", environment.getName(), targetIp, appName);
        
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
            updateInventory(targetIp);

            // 2. Execute Application Playbook
            String playbookPath = gitopsPath + "/ansible/deploy-backend.yml";
            String inventoryPath = gitopsPath + "/ansible/inventory.ini";
            executeProcess(new String[]{
                "ansible-playbook", 
                "-i", inventoryPath, 
                playbookPath, 
                "-e", "appName=" + appName,
                "-e", "ansible_user=" + sshUser
            }, deploymentLog, 600);

            deploymentLog.setStatus("SUCCESS");
        } catch (Exception e) {
            log.error("Application deployment failed: {}", e.getMessage());
            deploymentLog.setStatus("FAILED");
            deploymentLog.setLogOutput((deploymentLog.getLogOutput() == null ? "" : deploymentLog.getLogOutput()) + "\nERROR: " + e.getMessage());
        } finally {
            deploymentLogRepository.save(deploymentLog);
        }
    }

    private void updateInventory(String targetIp) throws Exception {
        File inventoryFile = new File(gitopsPath + "/ansible/inventory.ini");
        inventoryFile.getParentFile().mkdirs();
        try (FileWriter writer = new FileWriter(inventoryFile)) {
            writer.write("[agents]\n");
            writer.write("node-agent ansible_host=" + targetIp + " ansible_user=root\n"); // Simplified to root as default
        }
    }

    private void executeProcess(String[] command, DeploymentLog logEntry, int timeoutSeconds) throws Exception {
        executeProcessInternal(command, logEntry, timeoutSeconds, false);
    }

    private void executeProcessSecure(String[] command, DeploymentLog logEntry, int timeoutSeconds) throws Exception {
        executeProcessInternal(command, logEntry, timeoutSeconds, true);
    }

    private void executeProcessInternal(String[] command, DeploymentLog logEntry, int timeoutSeconds, boolean maskLastArg) throws Exception {
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
            throw new RuntimeException("Process exited with code " + process.exitValue());
        }
    }
}
