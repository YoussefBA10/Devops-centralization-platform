package com.monetique.eye.service;

import com.monetique.eye.client.ElasticsearchLogClient;
import com.monetique.eye.dto.LogEventDTO;
import com.monetique.eye.dto.LogResponseDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.entity.Application;

import java.time.Instant;

@Service
public class LogService {

    private final ElasticsearchLogClient elasticsearchLogClient;
    private final ApplicationRepository applicationRepository;

    public LogService(ElasticsearchLogClient elasticsearchLogClient, ApplicationRepository applicationRepository) {
        this.elasticsearchLogClient = elasticsearchLogClient;
        this.applicationRepository = applicationRepository;
    }

    public LogResponseDTO searchLogs(Long appId, String query, String severity, Instant from, Instant to, Pageable pageable) {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found"));
        
        String envLabel = ".*";
        if (app.getEnvironment() != null) {
            String raw = app.getEnvironment().getPrometheusLabel();
            if (raw != null) {
                if (raw.contains("=")) {
                    raw = raw.substring(raw.indexOf('=') + 1);
                }
                envLabel = raw.replace("\"", "").trim();
            } else {
                envLabel = app.getEnvironment().getSafeName();
            }
        }
        String serviceKeyword = app.getServiceNameKeyword();

        Page<LogEventDTO> page = elasticsearchLogClient.searchLogs(envLabel, serviceKeyword, app.getTargetNode(), query, severity, from, to, pageable);
        
        long totalDocs = elasticsearchLogClient.getDocumentCount(app.getName());
        
        // Simple heuristic for ingest rate for enterprise feel
        long eps = totalDocs / (30 * 24 * 60 * 60) + 1;
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

    public String exportLogsAsCsv(Long appId, String query, String severity, Instant from, Instant to) {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found"));
        
        String envLabel = ".*";
        if (app.getEnvironment() != null) {
            String raw = app.getEnvironment().getPrometheusLabel();
            if (raw != null) {
                if (raw.contains("=")) {
                    raw = raw.substring(raw.indexOf('=') + 1);
                }
                envLabel = raw.replace("\"", "").trim();
            } else {
                envLabel = app.getEnvironment().getSafeName();
            }
        }
        String serviceKeyword = app.getServiceNameKeyword();

        // Fetch top 1000 logs for export
        org.springframework.data.domain.Pageable exportPageable = org.springframework.data.domain.PageRequest.of(0, 1000);
        Page<LogEventDTO> page = elasticsearchLogClient.searchLogs(envLabel, serviceKeyword, null, query, severity, from, to, exportPageable);

        StringBuilder csv = new StringBuilder();
        csv.append('\uFEFF');
        csv.append("sep=,\n");
        csv.append("Timestamp,Source,Level,Category,Message\n");

        for (LogEventDTO log : page.getContent()) {
            csv.append(String.format("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"\n",
                log.getTimestamp(),
                log.getNode(),
                log.getSeverity(),
                log.getCategory(),
                (log.getRawMessage() != null ? log.getRawMessage().replace("\"", "\"\"") : "")
            ));
        }

        return csv.toString();
    }

    public void clearBuffer(Long appId) {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found"));
        elasticsearchLogClient.clearBuffer(app.getName());
    }
}
