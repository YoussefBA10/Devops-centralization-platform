package com.monetique.eye.config;

import com.monetique.eye.entity.Environment;
import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.User;
import com.monetique.eye.entity.ManagedNode;
import com.monetique.eye.entity.Cluster;
import com.monetique.eye.entity.enums.Role;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.UserRepository;
import com.monetique.eye.repository.ManagedNodeRepository;
import com.monetique.eye.repository.ClusterRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;

@Configuration(proxyBeanMethods = false)
public class DataInitializer {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final UserRepository userRepository;
    private final EnvironmentRepository environmentRepository;
    private final ApplicationRepository applicationRepository;
    private final ManagedNodeRepository managedNodeRepository;
    private final ClusterRepository clusterRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(UserRepository userRepository,
            EnvironmentRepository environmentRepository,
            ApplicationRepository applicationRepository,
            ManagedNodeRepository managedNodeRepository,
            ClusterRepository clusterRepository,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.environmentRepository = environmentRepository;
        this.applicationRepository = applicationRepository;
        this.managedNodeRepository = managedNodeRepository;
        this.clusterRepository = clusterRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public Environment manualInitialize(String environmentName, String centralIp, String sshUser) {
        String finalName = (environmentName == null || environmentName.isEmpty()) ? "central-node" : environmentName;
        log.info("Performing manual initialization for environment: {}", finalName);

        // 0. Create Cluster
        Cluster cluster = new Cluster();
        cluster.setName("central-node");
        cluster.setDescription("Primary management and telemetry cluster");
        cluster = clusterRepository.save(cluster);

        // 1. Create Environment
        Environment env = new Environment();
        env.setName(finalName);
        env.setPrometheusLabel(finalName);
        env.setCentralNodeIp(centralIp);
        env.setCluster(cluster);
        env.setCreatedAt(java.time.LocalDateTime.now());
        env = environmentRepository.save(env);

        // 1.1 Create ManagedNode entry for the central node
        ManagedNode centralNode = ManagedNode.builder()
                .ip(centralIp)
                .nodeName("central-node")
                .sshUser(sshUser)
                .sshPassword("auto-provisioned") // Placeholder, should be handled via SSH keys or user input in
                                                 // production
                .environment(env)
                .build();
        managedNodeRepository.save(centralNode);

        // 2. Create Core Applications matching docker-compose container names
        // These names MUST match the container_name in docker-compose.yml
        Application backend = Application.builder()
                .name("backend")
                .environment(env)
                .serviceNameKeyword("backend")
                .type("BACKEND")
                .appLanguage("Java Spring Boot")
                .targetNode(centralIp)
                .port(8880)
                .containerPort(8880)
                .metricsPort(8880)
                .metricsPath("/actuator/prometheus")
                .metricsTestStatus("SUCCESS")
                .status("RUNNING")
                .repoUrl("local")
                .branch("main")
                .build();
        applicationRepository.save(backend);

        Application frontend = Application.builder()
                .name("frontend")
                .environment(env)
                .serviceNameKeyword("frontend")
                .type("FRONTEND")
                .appLanguage("React")
                .targetNode(centralIp)
                .port(80)
                .containerPort(80)
                .status("RUNNING")
                .repoUrl("local")
                .branch("main")
                .build();
        applicationRepository.save(frontend);

        log.info("Manual initialization completed for environment {} with apps [backend, frontend]", env.getId());
        return env;
    }

    @Bean
    public CommandLineRunner initData() {
        return args -> {
            log.info("Starting data initialization...");

            User admin = userRepository.findByUsername("admin").orElse(null);
            if (admin == null) {
                admin = new User();
                admin.setUsername("admin");
                admin.setRole(Role.ADMIN);
                log.info("Default ADMIN user created.");
            } else {
                log.info("Admin user found — refreshing password hash.");
            }
            // Always re-encode so a stale hash never blocks login
            admin.setPassword(passwordEncoder.encode("admin123"));
            userRepository.save(admin);

            log.info("Data initialization completed.");
        };
    }
}
