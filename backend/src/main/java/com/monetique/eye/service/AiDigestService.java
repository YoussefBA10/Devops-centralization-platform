package com.monetique.eye.service;

import com.monetique.eye.entity.AiOperationalSummary;
import com.monetique.eye.entity.Application;
import com.monetique.eye.repository.AiOperationalSummaryRepository;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class AiDigestService {

    private final GroqService groqService;
    private final AiOperationalSummaryRepository repository;

    public AiDigestService(GroqService groqService, AiOperationalSummaryRepository repository) {
        this.groqService = groqService;
        this.repository = repository;
    }

    public AiOperationalSummary generateApplicationDigest(Application application, double currentStabilityIndex, long errorCount) {
        String prompt = String.format("""
                Summarize the operational status for application '%s'.
                Context:
                - Current Stability Index: %.2f/100
                - Error Count (Last Minute): %d
                - Risk Profile: %s
                
                Provide a 2-sentence executive summary and a business risk assessment.
                """, 
                application.getName(), 
                currentStabilityIndex, 
                errorCount,
                currentStabilityIndex < 80 ? "ELEVATED" : "STABLE");

        String summaryText = groqService.generateSummary(prompt);
        
        AiOperationalSummary summary = AiOperationalSummary.builder()
                .application(application)
                .summaryText(summaryText)
                .businessRisk(currentStabilityIndex < 50 ? "HIGH" : (currentStabilityIndex < 80 ? "MEDIUM" : "LOW"))
                .build();
                
        return repository.save(summary);
    }
}
