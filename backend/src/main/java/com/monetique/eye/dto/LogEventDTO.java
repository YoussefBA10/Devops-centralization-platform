package com.monetique.eye.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogEventDTO {
    private String id;
    private Instant timestamp;
    private String node;           // vmpipe, node-1, node-2...
    private String service;
    private String severity;       // CRITICAL, ERROR, WARN, INFO
    private String category;       // DATABASE, NETWORK, APPLICATION, EXTERNAL
    private String errorType;      // e.g. NullPointerException, ConnectionTimeout
    private String normalizedSummary;
    private String rawMessage;
    private String traceId;        // for multi-line grouping
}
