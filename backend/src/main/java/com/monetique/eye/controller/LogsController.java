package com.monetique.eye.controller;

import com.monetique.eye.entity.Environment;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.service.ElasticsearchLogService;
import com.monetique.eye.security.RequiresPermission;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/logs")
@RequiresPermission("MONITORING_LOGS")
public class LogsController {

    private final ElasticsearchLogService esLogService;
    private final EnvironmentRepository environmentRepository;

    public LogsController(ElasticsearchLogService esLogService, EnvironmentRepository environmentRepository) {
        this.esLogService = esLogService;
        this.environmentRepository = environmentRepository;
    }

    @GetMapping("/search")
    public List<Map<String, Object>> searchLogs(@RequestParam Long environmentId, 
                                                @RequestParam(required = false) String query, 
                                                @RequestParam(defaultValue = "50") int limit) {
        Environment env = environmentRepository.findById(environmentId).orElse(null);
        if (env == null) return List.of();
        
        // Use getSafeName() to match the Logstash/Filebeat index naming convention (e.g. "demo-pre-prod-env")
        String searchLabel = env.getSafeName();
        return esLogService.getRecentLogs(searchLabel, limit);
    }
}
