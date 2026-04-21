package com.monetique.eye.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ServiceResourceDTO {
    private String serviceName;
    private String nodeName;
    private String containerId;
    
    // CPU
    private double cpuUsageCores;
    private double cpuUsagePercent; // of node total
    
    // Memory
    private long memoryUsageBytes; // in bytes
    private double memoryUsagePercent; // of node total
    
    // I/O
    private double diskReadBytesPerSec;
    private double diskWriteBytesPerSec;
    private double networkRxBytesPerSec;
    private double networkTxBytesPerSec;
    
    // Meta
    private int restartCount;
    private long uptimeSeconds;
    private String status; // HEALTHY, WARNING, CRITICAL
    private String healthReason;
}
