package com.monetique.eye.controller;

import com.monetique.eye.dto.ServiceResourceDTO;
import com.monetique.eye.dto.StabilityResponse;
import com.monetique.eye.dto.TopologyData;
import com.monetique.eye.service.InfrastructureService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/infrastructure")
@RequiredArgsConstructor
public class InfrastructureController {

    private final InfrastructureService infrastructureService;

    @GetMapping("/global")
    public StabilityResponse getGlobalStats() {
        return infrastructureService.getGlobalStats();
    }

    @GetMapping("/global/stability")
    public StabilityResponse getGlobalStability() {
        return infrastructureService.getGlobalStability();
    }

    @GetMapping("/global/topology")
    public TopologyData getTopology(@RequestParam Long environmentId) {
        return infrastructureService.getEnvironmentTopology(environmentId);
    }

    @GetMapping("/global/topology/all")
    public TopologyData getTopologyAll() {
        System.out.println("DEBUG: InfrastructureController.getTopologyAll called");
        return infrastructureService.getAllEnvironmentsTopology();
    }

    @GetMapping("/heatmap")
    public Map<String, Object> getHeatmap(@RequestParam Long environmentId) {
        // Keeping as stub for now
        return Map.of(
                "environmentId", environmentId,
                "nodes", List.of(
                        Map.of("id", "node-01", "riskScore", 15, "status", "HEALTHY"),
                        Map.of("id", "node-02", "riskScore", 85, "status", "CRITICAL")
                )
        );
    }

    @GetMapping("/services/resources")
    public List<ServiceResourceDTO> getServiceResources(@RequestParam Long environmentId) {
        return infrastructureService.getEnvironmentServiceResources(environmentId);
    }
}
