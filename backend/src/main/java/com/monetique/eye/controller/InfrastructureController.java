package com.monetique.eye.controller;

import com.monetique.eye.dto.ServiceResourceDTO;
import com.monetique.eye.dto.StabilityResponse;
import com.monetique.eye.dto.TopologyData;
import com.monetique.eye.service.InfrastructureService;
import com.monetique.eye.security.RequiresPermission;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/infrastructure")
@RequiredArgsConstructor
public class InfrastructureController {

    private final InfrastructureService infrastructureService;
    private final com.monetique.eye.service.DeploymentService deploymentService;

    @GetMapping("/global")
    @RequiresPermission("ENV_DEPLOYMENT_VIEW")
    public StabilityResponse getGlobalStats() {
        return infrastructureService.getGlobalStats();
    }

    @GetMapping("/global/stability")
    @RequiresPermission("ENV_DEPLOYMENT_VIEW")
    public StabilityResponse getGlobalStability() {
        return infrastructureService.getGlobalStability();
    }

    @GetMapping("/global/topology")
    @RequiresPermission("MONITORING_INFRA_GRAPH")
    public TopologyData getTopology(@RequestParam Long environmentId) {
        return infrastructureService.getEnvironmentTopology(environmentId);
    }

    @GetMapping("/global/topology/all")
    @RequiresPermission("MONITORING_INFRA_GRAPH")
    public TopologyData getTopologyAll() {
        System.out.println("DEBUG: InfrastructureController.getTopologyAll called");
        return infrastructureService.getAllEnvironmentsTopology();
    }

    @GetMapping("/heatmap")
    @RequiresPermission("MONITORING_OBSERVABILITY")
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
    @RequiresPermission("MONITORING_OBSERVABILITY")
    public List<ServiceResourceDTO> getServiceResources(@RequestParam Long environmentId) {
        return infrastructureService.getEnvironmentServiceResources(environmentId);
    }

    @PostMapping("/restart-container")
    @RequiresPermission("APP_DEPLOYMENT_EDIT")
    public Map<String, String> restartContainer(@RequestBody Map<String, String> request) {
        String targetIp = request.get("targetIp");
        String containerName = request.get("containerName");
        deploymentService.restartContainer(targetIp, containerName);
        return Map.of("message", "Restart command sent for " + containerName);
    }

    @PostMapping("/sync-monitoring")
    public Map<String, String> syncMonitoring() {
        deploymentService.syncMonitoring();
        return Map.of("message", "Global monitoring synchronization triggered.");
    }
}
