package com.monetique.eye.config;

import com.monetique.eye.entity.Environment;
import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.User;
import com.monetique.eye.entity.enums.Role;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;

@Configuration
public class DataInitializer {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final UserRepository userRepository;
    private final EnvironmentRepository environmentRepository;
    private final ApplicationRepository applicationRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(UserRepository userRepository, 
                           EnvironmentRepository environmentRepository, 
                           ApplicationRepository applicationRepository,
                           PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.environmentRepository = environmentRepository;
        this.applicationRepository = applicationRepository;
        this.passwordEncoder = passwordEncoder;
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
