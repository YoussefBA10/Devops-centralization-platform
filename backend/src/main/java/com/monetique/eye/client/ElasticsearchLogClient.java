package com.monetique.eye.client;

import com.monetique.eye.dto.LogEventDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;

public interface ElasticsearchLogClient {
    Page<LogEventDTO> searchLogs(Long appId, String query, LocalDateTime from, LocalDateTime to, Pageable pageable);
    void clearBuffer(Long appId);
    long getDocumentCount(Long appId);
}
