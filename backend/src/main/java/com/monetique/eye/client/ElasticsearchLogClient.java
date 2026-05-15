package com.monetique.eye.client;

import com.monetique.eye.dto.LogEventDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;

public interface ElasticsearchLogClient {
    Page<LogEventDTO> searchLogs(String displayName, String keywordName, String nodeName, String query, String severity, java.time.Instant from, java.time.Instant to, Pageable pageable);
    void clearBuffer(String appName);
    long getDocumentCount(String appName);
    java.util.Map<String, Object> fetchSreSignals(String envLabel, String appFilter, java.time.Instant from, java.time.Instant to);
}
