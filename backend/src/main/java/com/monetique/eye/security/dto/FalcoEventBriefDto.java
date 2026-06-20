package com.monetique.eye.security.dto;

import com.monetique.eye.security.entity.enums.FalcoPriority;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FalcoEventBriefDto {
    private Long id;
    private String ruleName;
    private FalcoPriority priority;
    private String output;
    private LocalDateTime timestamp;
}
