package com.monetique.eye.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogResponseDTO {
    private List<LogEventDTO> logs;
    private long total;
    private int page;
    private int size;
    private String ingestRate;
    private int retentionDays;
}
