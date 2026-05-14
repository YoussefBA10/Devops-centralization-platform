package com.monetique.eye.controller;

import com.monetique.eye.dto.LogAnalyticsResponseDTO;
import com.monetique.eye.security.RequiresPermission;
import com.monetique.eye.service.LogAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
@RequiresPermission("MONITORING_OBSERVABILITY")
public class LogAnalyticsController {

    private final LogAnalyticsService analyticsService;

    @GetMapping("/dashboard")
    public LogAnalyticsResponseDTO getDashboardData(
            @RequestParam Long environmentId,
            @RequestParam(defaultValue = "6h") String range,
            @RequestParam(required = false) String serviceName,
            @RequestParam(required = false) String nodeName) {
        return analyticsService.getDashboardData(environmentId, range, serviceName, nodeName);
    }
}
