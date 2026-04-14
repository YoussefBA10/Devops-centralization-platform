package com.monetique.eye.service;

import com.monetique.eye.entity.LogAggregationWindow;
import com.monetique.eye.entity.Application;
import com.monetique.eye.repository.LogAggregationWindowRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class LogAggregationService {

    private final LogAggregationWindowRepository repository;

    public LogAggregationService(LogAggregationWindowRepository repository) {
        this.repository = repository;
    }

    public double calculateStabilityIndex(Application application, long currentErrorCount) {
        // Fetch last 24 1-hour windows for baseline (simplified)
        List<LogAggregationWindow> baseline = repository.findTop24ByApplicationOrderByWindowEndDesc(application);

        if (baseline.isEmpty()) {
            return 100.0; // Perfect score if no baseline
        }

        double mean = baseline.stream().mapToDouble(LogAggregationWindow::getErrorCount).average().orElse(0.0);
        double variance = baseline.stream()
                .mapToDouble(w -> Math.pow(w.getErrorCount() - mean, 2))
                .average()
                .orElse(0.0);
        double stdDev = Math.sqrt(variance);

        if (stdDev == 0) {
            return currentErrorCount == 0 ? 100.0 : 50.0;
        }

        double zScore = (currentErrorCount - mean) / stdDev;

        // Penalty model: Only penalize if zScore > 1.0 (slight deviation)
        // High penalty if zScore > 3.0 (outlier)
        double score = 100.0;
        if (zScore > 3.0) {
            score = 30.0;
        } else if (zScore > 1.0) {
            score = 100.0 - (zScore * 20.0);
        }

        return Math.max(0, Math.min(100, score));
    }

    public void saveWindow(Application application, long errorCount, double stabilityIndex) {
        LogAggregationWindow window = LogAggregationWindow.builder()
                .application(application)
                .errorCount((int) errorCount)
                .stabilityScore(stabilityIndex)
                .windowStart(LocalDateTime.now().minusMinutes(1))
                .windowEnd(LocalDateTime.now())
                .build();
        repository.save(window);
    }
}
