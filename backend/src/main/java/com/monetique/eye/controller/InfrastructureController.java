package com.monetique.eye.controller;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/infrastructure")
public class InfrastructureController {

    @GetMapping("/topology")
    public Map<String, Object> getTopology(@RequestParam Long environmentId) {
        // Stub implementation returning simulated cluster node map
        return Map.of(
                "environmentId", environmentId,
                "nodes", List.of(
                        Map.of("id", "node-01", "type", "app-server", "ip", "192.168.126.130", "cpu", 45),
                        Map.of("id", "node-02", "type", "db-server", "ip", "192.168.126.131", "cpu", 78)
                ),
                "edges", List.of(
                        Map.of("source", "node-01", "target", "node-02")
                )
        );
    }

    @GetMapping("/heatmap")
    public Map<String, Object> getHeatmap(@RequestParam Long environmentId) {
        // Stub implementation returning simulated risk heatmap for the environment
        return Map.of(
                "environmentId", environmentId,
                "nodes", List.of(
                        Map.of("id", "node-01", "riskScore", 15, "status", "HEALTHY"),
                        Map.of("id", "node-02", "riskScore", 85, "status", "CRITICAL")
                )
        );
    }
}
