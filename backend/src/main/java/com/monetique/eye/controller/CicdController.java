package com.monetique.eye.controller;

import com.monetique.eye.entity.DeploymentEvent;
import com.monetique.eye.service.CicdTrackingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class CicdController {

    private final CicdTrackingService cicdTrackingService;
    private final WebClient.Builder webClientBuilder;

    // ───────────────────────────────────────────────────────────────
    // POST /api/v1/deployments/events — called by Jenkins pipelines
    // ───────────────────────────────────────────────────────────────
    @PostMapping("/deployments/events")
    public ResponseEntity<?> recordDeploymentEvent(@RequestBody Map<String, String> body) {
        try {
            Long appId = Long.parseLong(body.get("appId"));
            String env = body.get("env");
            String version = body.get("version");
            String buildNumber = body.get("buildNumber");
            String status = body.get("status");

            if (env == null || version == null || status == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "env, version, and status are required"));
            }

            DeploymentEvent event = cicdTrackingService.recordEvent(appId, env, version, buildNumber, status);
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "id", event.getId(),
                    "timestamp", event.getStartedAt().toString()
            ));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid appId format"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ───────────────────────────────────────────────────────────────
    // GET /api/v1/deployments — paginated deployment history
    // ───────────────────────────────────────────────────────────────
    @GetMapping("/deployments")
    public ResponseEntity<Page<DeploymentEvent>> getDeployments(
            @RequestParam(required = false) Long appId,
            @RequestParam(required = false) String env,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Page<DeploymentEvent> events = cicdTrackingService.getDeployments(
                appId, env, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "startedAt")));
        return ResponseEntity.ok(events);
    }

    // ───────────────────────────────────────────────────────────────
    // POST /api/v1/cicd/trigger — proxy to Jenkins build API
    // ───────────────────────────────────────────────────────────────
    @PostMapping("/cicd/trigger")
    public ResponseEntity<?> triggerPipeline(@RequestBody Map<String, String> body) {
        String jobName = body.get("jobName");
        String appId = body.get("appId");
        String env = body.get("env");
        String gitBranch = body.getOrDefault("gitBranch", "main");

        if (jobName == null || appId == null || env == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "jobName, appId, and env are required"));
        }

        try {
            String jenkinsUrl = System.getenv("JENKINS_URL") != null
                    ? System.getenv("JENKINS_URL")
                    : "http://jenkins:8080";

            String triggerUrl = jenkinsUrl + "/job/" + jobName + "/buildWithParameters";

            webClientBuilder.build()
                    .post()
                    .uri(triggerUrl + "?APP_ID={appId}&ENV={env}&GIT_BRANCH={branch}",
                            appId, env, gitBranch)
                    .retrieve()
                    .toBodilessEntity()
                    .block();

            log.info("Triggered Jenkins pipeline: job={}, appId={}, env={}", jobName, appId, env);
            return ResponseEntity.ok(Map.of("message", "Pipeline triggered", "job", jobName));

        } catch (Exception e) {
            log.error("Failed to trigger Jenkins pipeline: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Failed to trigger pipeline: " + e.getMessage()));
        }
    }
}
