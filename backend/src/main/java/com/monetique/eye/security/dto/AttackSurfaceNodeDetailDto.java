package com.monetique.eye.security.dto;

import com.monetique.eye.security.dto.AttackSurfaceDto.AttackSurfaceNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttackSurfaceNodeDetailDto {
    private AttackSurfaceNode node;
    private String serviceName;
    private String applicationName;
    private List<String> riskReasons;
    private List<VulnerabilityDto> vulnerabilities;
    private List<FalcoEventBriefDto> falcoEvents;
    private List<AttackSurfaceNode> atRiskChildren;
    private List<String> remediationHints;
}
