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

    public void logActivity(String title, String type, String envName) {
        ActivityLog log = ActivityLog.builder()
                .title(title)
                .type(type)
                .env(envName != null ? envName : "Global")
                .timestamp(LocalDateTime.now())
                .build();
        activityLogRepository.save(log);
    }
}
