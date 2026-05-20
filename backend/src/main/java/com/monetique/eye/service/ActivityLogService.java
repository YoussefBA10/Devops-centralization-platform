package com.monetique.eye.service;

import com.monetique.eye.entity.ActivityLog;
import com.monetique.eye.repository.ActivityLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class ActivityLogService {

    private final ActivityLogRepository activityLogRepository;
    private final com.monetique.eye.repository.UserRepository userRepository;

    public void logActivity(String title, String type, String envName) {
        com.monetique.eye.entity.User user = null;
        try {
            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated()) {
                String username = auth.getName();
                user = userRepository.findByUsername(username).orElse(null);
            }
        } catch (Exception e) {
            // Log as system if no security context
        }


        ActivityLog log = ActivityLog.builder()
                .title(title)
                .type(type)
                .env(envName != null ? envName : "Global")
                .executedBy(user)
                .timestamp(Instant.now())
                .build();
        activityLogRepository.save(log);
    }
}
