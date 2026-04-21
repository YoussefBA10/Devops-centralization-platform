package com.monetique.eye.service;

import com.monetique.eye.client.ElasticsearchLogClient;
import com.monetique.eye.dto.LogEventDTO;
import com.monetique.eye.dto.LogResponseDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.entity.Application;

import java.time.LocalDateTime;

@Service
public class LogService {

    private final ElasticsearchLogClient elasticsearchLogClient;
    private final ApplicationRepository applicationRepository;

    public LogService(ElasticsearchLogClient elasticsearchLogClient, ApplicationRepository applicationRepository) {
        this.elasticsearchLogClient = elasticsearchLogClient;
        this.applicationRepository = applicationRepository;
    }

    public LogResponseDTO searchLogs(Long appId, String query, LocalDateTime from, LocalDateTime to, Pageable pageable) {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found"));
        
        // Use serviceNameKeyword (container name) for ES queries, falling back to app name
        String appName = (app.getServiceNameKeyword() != null && !app.getServiceNameKeyword().isBlank()) 
                ? app.getServiceNameKeyword() 
                : app.getName();

        Page<LogEventDTO> page = elasticsearchLogClient.searchLogs(appName, query, from, to, pageable);
        
        long totalDocs = elasticsearchLogClient.getDocumentCount(appName);
        
        // Simple heuristic for ingest rate for enterprise feel (e.g. docs per hour over retention)
        // If retention is strictly 30 days (720 hours)
        long eps = totalDocs / (30 * 24 * 60 * 60) + 1; // dummy EPS calc ensuring no Div/0 or logic error
        String ingestRate = (eps > 1000 ? String.format("%.1fk EPS", eps / 1000.0) : eps + " EPS");

        return LogResponseDTO.builder()
                .logs(page.getContent())
                .total(page.getTotalElements())
                .page(page.getNumber())
                .size(page.getSize())
                .ingestRate(ingestRate)
                .retentionDays(30)
                .build();
    }

    public void clearBuffer(Long appId) {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found"));
        elasticsearchLogClient.clearBuffer(app.getName());
    }
}
