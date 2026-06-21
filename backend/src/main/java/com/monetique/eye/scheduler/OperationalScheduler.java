package com.monetique.eye.scheduler;

import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.Environment;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.service.ElasticsearchLogService;
import com.monetique.eye.service.LogAggregationService;
import com.monetique.eye.service.PrometheusClient;
import com.monetique.eye.service.RecurringPatternService;
import com.monetique.eye.service.AiDigestService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class OperationalScheduler {

    private static final Logger log = LoggerFactory.getLogger(OperationalScheduler.class);

    // Only generate AI digests every N cycles to stay within Groq rate limits
    private static final int AI_DIGEST_EVERY_N_CYCLES = 10;
    private final AtomicInteger cycleCounter = new AtomicInteger(0);

    private final EnvironmentRepository environmentRepository;
    private final ApplicationRepository applicationRepository;
    private final PrometheusClient prometheusClient;
    private final ElasticsearchLogService esLogService;
    private final LogAggregationService aggregationService;
    private final RecurringPatternService patternService;
    private final AiDigestService aiDigestService;

    public OperationalScheduler(EnvironmentRepository environmentRepository,
                                 ApplicationRepository applicationRepository,
                                 PrometheusClient prometheusClient,
                                 ElasticsearchLogService esLogService,
                                 LogAggregationService aggregationService,
                                 RecurringPatternService patternService,
                                 AiDigestService aiDigestService) {
        this.environmentRepository = environmentRepository;
        this.applicationRepository = applicationRepository;
        this.prometheusClient = prometheusClient;
        this.esLogService = esLogService;
        this.aggregationService = aggregationService;
        this.patternService = patternService;
        this.aiDigestService = aiDigestService;
    }

    @Scheduled(fixedRate = 60000)
    public void runObservabilityCycle() {
        log.info("Starting observability cycle...");
        int currentCycle = cycleCounter.incrementAndGet();
        boolean runAiDigest = (currentCycle % AI_DIGEST_EVERY_N_CYCLES == 0);

        List<Environment> environments = environmentRepository.findAll();
        for (Environment env : environments) {
            String label = env.getPrometheusLabel();
            if (label == null || label.isEmpty()) continue;

            log.info("Processing environment: {}", env.getName());

            List<Application> apps = applicationRepository.findByEnvironmentId(env.getId());
            for (Application app : apps) {
                // 1. Fetch Logs
                List<Map<String, Object>> recentLogs = esLogService.getRecentLogs(env.getName().toLowerCase(), 100);
                
                // 2. Fingerprint recurring patterns
                patternService.processLogs(app, recentLogs);

                // 3. Aggregate 1-minute errors and calculate stability
                long errorCount = esLogService.getErrorCount(env.getName().toLowerCase(), 1);
                double stabilityIndex = aggregationService.calculateStabilityIndex(app, errorCount);
                
                // 4. Save window
                aggregationService.saveWindow(app, errorCount, stabilityIndex);

                // 5. Generate AI Digest (throttled to every 10 minutes)
                if (runAiDigest) {
                    try {
                        aiDigestService.generateApplicationDigest(app, stabilityIndex, errorCount);
                    } catch (Exception e) {
                        log.error("Failed to generate AI digest for {}: {}", app.getName(), e.getMessage());
                    }
                }
            }
        }
        
        log.info("Observability cycle {} completed.{}", currentCycle, runAiDigest ? " (AI digests generated)" : "");
    }
}

