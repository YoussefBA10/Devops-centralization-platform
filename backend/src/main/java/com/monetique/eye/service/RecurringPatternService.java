package com.monetique.eye.service;

import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.RecurringPattern;
import com.monetique.eye.repository.RecurringPatternRepository;
import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;

@Service
public class RecurringPatternService {

    private final RecurringPatternRepository repository;

    public RecurringPatternService(RecurringPatternRepository repository) {
        this.repository = repository;
    }

    public void processLogs(Application application, java.util.List<Map<String, Object>> logs) {
        for (Map<String, Object> log : logs) {
            String message = log.get("message") != null ? log.get("message").toString() : "";
            if (message.isEmpty()) continue;

            String fingerprint = generateFingerprint(message);
            String hash = calculateHash(fingerprint);

            Optional<RecurringPattern> existing = repository.findByApplicationAndPatternHash(application, hash);
            if (existing.isPresent()) {
                RecurringPattern pattern = existing.get();
                pattern.setOccurrences(pattern.getOccurrences() + 1);
                pattern.setLastSeen(LocalDateTime.now());
                repository.save(pattern);
            } else {
                RecurringPattern pattern = RecurringPattern.builder()
                        .application(application)
                        .patternHash(hash)
                        .sampleMessage(message)
                        .occurrences(1)
                        .riskLevel("NEW")
                        .firstSeen(LocalDateTime.now())
                        .lastSeen(LocalDateTime.now())
                        .build();
                repository.save(pattern);
            }
        }
    }

    private String generateFingerprint(String message) {
        // Strip UUIDs
        message = message.replaceAll("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "{UUID}");
        // Strip Timestamps (common patterns)
        message = message.replaceAll("\\d{4}-\\d{2}-\\d{2}[T\\s]\\d{2}:\\d{2}:\\d{2}", "{TS}");
        // Strip Numbers (IDs etc)
        message = message.replaceAll("\\d+", "{N}");
        return message;
    }

    private String calculateHash(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes());
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            return String.valueOf(input.hashCode());
        }
    }
}
