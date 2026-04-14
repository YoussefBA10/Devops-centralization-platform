package com.monetique.eye.controller;

import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.Environment;
import com.monetique.eye.entity.User;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/setup")
public class SetupController {

    private final EnvironmentRepository environmentRepository;
    private final ApplicationRepository applicationRepository;
    private final UserRepository userRepository;

    public SetupController(EnvironmentRepository environmentRepository,
                           ApplicationRepository applicationRepository,
                           UserRepository userRepository) {
        this.environmentRepository = environmentRepository;
        this.applicationRepository = applicationRepository;
        this.userRepository = userRepository;
    }

    @PostMapping("/initialize")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> initialize(@RequestBody Map<String, String> request, Authentication authentication) {
        if (environmentRepository.count() > 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "Platform is already initialized"));
        }

        String vmpipeIp = request.get("vmpipeIp");
        String vmpipeHostname = request.getOrDefault("vmpipeHostname", "vmpipe");
        String environmentName = request.getOrDefault("environmentName", "vmpipe");

        // 1. Create Environment
        Environment env = Environment.builder()
                .name(environmentName)
                .description("Central node environment for " + vmpipeHostname)
                .prometheusLabel("env=" + environmentName)
                .centralNodeIp(vmpipeIp)
                .build();
        
        env = environmentRepository.save(env);

        // 2. Create Applications
        Application backend = Application.builder()
                .name("Backend")
                .serviceNameKeyword("backend")
                .environment(env)
                .build();
        
        Application frontend = Application.builder()
                .name("Frontend")
                .serviceNameKeyword("frontend")
                .environment(env)
                .build();

        applicationRepository.save(backend);
        applicationRepository.save(frontend);

        // 3. Link Admin User
        User admin = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Logged in user not found"));
        
        admin.getEnvironments().add(env);
        userRepository.save(admin);

        return ResponseEntity.ok(Map.of("message", "Platform initialized successfully"));
    }
}
