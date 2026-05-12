package com.monetique.eye.service;

import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.DeploymentEvent;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.DeploymentEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class CicdTrackingService {

    private final DeploymentEventRepository deploymentEventRepository;
    private final ApplicationRepository applicationRepository;
    private final WebClient.Builder webClientBuilder;

    @Value("${victoriametrics.url:http://localhost:8428}")
    private String victoriaMetricsUrl;

    /**
     * Records a deployment event and pushes a synthetic metric to VictoriaMetrics.
     * Never throws — a failed notification must not affect anything.
     */
    public DeploymentEvent recordEvent(Long appId, String env, String version,
                                        String buildNumber, String status) {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found: " + appId));

        DeploymentEvent event = DeploymentEvent.builder()
                .application(app)
                .env(env)
                .version(version)
                .buildNumber(buildNumber)
                .status(status)
                .build();

        event = deploymentEventRepository.save(event);
        log.info("Recorded deployment event: app={}, env={}, version={}, status={}",
                app.getName(), env, version, status);

        // Push metric to VictoriaMetrics (fire and forget)
        pushDeploymentMetric(appId, env, version, status);

        return event;
    }

    public Page<DeploymentEvent> getDeployments(Long appId, String env, Pageable pageable) {
        if (appId != null && env != null && !env.isEmpty()) {
            return deploymentEventRepository.findByApplicationIdAndEnv(appId, env, pageable);
        } else if (appId != null) {
            return deploymentEventRepository.findByApplicationId(appId, pageable);
        }
        return deploymentEventRepository.findAll(pageable);
    }

    /**
     * Push a synthetic metric to VictoriaMetrics so deployments are visible
     * as annotations in monitoring dashboards.
     */
    private void pushDeploymentMetric(Long appId, String env, String version, String status) {
        try {
            long epochMs = Instant.now().toEpochMilli();
            String metric = String.format(
                    "deployment_event{app_id=\"%d\",env=\"%s\",version=\"%s\",status=\"%s\"} 1 %d",
                    appId, env, version, status, epochMs);

            webClientBuilder.baseUrl(victoriaMetricsUrl).build()
                    .post()
                    .uri("/api/v1/import/prometheus")
                    .bodyValue(metric)
                    .retrieve()
                    .toBodilessEntity()
                    .subscribe(
                            ok -> log.debug("Deployment metric pushed to VictoriaMetrics"),
                            err -> log.warn("Failed to push deployment metric (non-blocking): {}", err.getMessage())
                    );
        } catch (Exception e) {
            log.warn("Failed to push deployment metric (non-blocking): {}", e.getMessage());
        }
    }
}
