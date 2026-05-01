package com.monetique.eye.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
public class IncidentDTO {
    private String alertName;
    private String severity;
    private String summary;
    private String description;
    private String instance;
    private String state;
    private LocalDateTime activeAt;
    private Map<String, String> labels;
}
