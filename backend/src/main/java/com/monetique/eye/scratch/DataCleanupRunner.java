package com.monetique.eye.scratch;

import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.Environment;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.service.DeploymentService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataCleanupRunner implements CommandLineRunner {

    private final EnvironmentRepository environmentRepository;
    private final ApplicationRepository applicationRepository;
    private final DeploymentService deploymentService;

    @Override
    public void run(String... args) throws Exception {
        log.info("--- STARTING DATABASE IP CLEANUP ---");

        environmentRepository.findAll().forEach(env -> {
            String ip = env.getCentralNodeIp();
            if (ip != null && (ip.contains("http") || ip.contains("/"))) {
                String clean = ip.replaceAll("^https?://", "").replaceAll("/", "").replaceAll("http", "");
                log.info("Cleaning Environment IP: {} -> {}", ip, clean);
                env.setCentralNodeIp(clean);
                environmentRepository.save(env);
            }
        });

        applicationRepository.findAll().forEach(app -> {
            String ip = app.getTargetNode();
            if (ip != null && (ip.contains("http") || ip.contains("/"))) {
                String clean = ip.replaceAll("^https?://", "").replaceAll("/", "").replaceAll("http", "");
                log.info("Cleaning Application Target Node: {} -> {}", ip, clean);
                app.setTargetNode(clean);
                applicationRepository.save(app);
            }
        });

        log.info("--- DATABASE IP CLEANUP COMPLETED ---");

        log.info("Triggering automatic monitoring synchronization...");
        try {
            deploymentService.syncMonitoring();
            log.info("Monitoring synchronization triggered successfully.");
        } catch (Exception e) {
            log.error("Failed to trigger sync: {}", e.getMessage());
        }
    }
}
