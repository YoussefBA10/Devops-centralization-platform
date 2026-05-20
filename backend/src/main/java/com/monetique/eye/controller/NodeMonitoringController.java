package com.monetique.eye.controller;

import com.monetique.eye.service.NodeMonitoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/prometheus/nodes")
@RequiredArgsConstructor
public class NodeMonitoringController {

    private final NodeMonitoringService nodeMonitoringService;

    @GetMapping("/query")
    public Map<String, Object> query(
            @RequestParam String key,
            @RequestParam Map<String, String> allParams) {
        return nodeMonitoringService.queryNodeInstant(key, allParams);
    }

    @GetMapping("/query_range")
    public Map<String, Object> queryRange(
            @RequestParam String key,
            @RequestParam String start,
            @RequestParam String end,
            @RequestParam String step,
            @RequestParam Map<String, String> allParams) {
        return nodeMonitoringService.queryNodeRange(key, start, end, step, allParams);
    }
}
