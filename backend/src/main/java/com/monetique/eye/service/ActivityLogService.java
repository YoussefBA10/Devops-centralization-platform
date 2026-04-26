package com.monetique.eye.service;

import com.monetique.eye.entity.ActivityLog;
import com.monetique.eye.repository.ActivityLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class ActivityLogService {

    private final ActivityLogRepository activityLogRepository;
    private final com.monetique.eye.repository.UserRepository userRepository;

    public void logActivity(String title, String type, String envName) {
        String username = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        com.monetique.eye.entity.User user = userRepository.findByUsername(username).orElse(null);

        ActivityLog log = ActivityLog.builder()
                .title(title)
                .type(type)
                .env(envName != null ? envName : "Global")
                .executedBy(user)
                .timestamp(LocalDateTime.now())
                .build();
        activityLogRepository.save(log);
    }
}
