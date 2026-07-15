package com.monetique.eye.service;

import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.entity.Environment;
import com.monetique.eye.entity.Application;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.regex.Pattern;

@Component
public class IntentClassifier {

    private static final Pattern ACTION_PATTERN = Pattern.compile("(?i)\\b(restart|deploy|silence|acknowledge|resolve|create ticket|add node)\\b");
    private static final Pattern SECURITY_PATTERN = Pattern.compile("(?i)\\b(security|cve|vulnerability|falco|dependency-check|scan|suspicious|posture)\\b");
    private static final Pattern METRIC_PATTERN = Pattern.compile("(?i)\\b(cpu|memory|disk|latency|response time|network load|usage|p95|metrics?|performance)\\b");
    private static final Pattern LOG_PATTERN = Pattern.compile("(?i)\\b(logs?|errors?|warn|search|exception|trace|spike in logs)\\b");
    private static final Pattern INCIDENT_PATTERN = Pattern.compile("(?i)\\b(alerts?|incidents?|root cause|mttr|firing|resolved)\\b");
    private static final Pattern DEPLOYMENT_PATTERN = Pattern.compile("(?i)\\b(deployment|rollback|version|ci/cd|release)\\b");
    private static final Pattern TOPOLOGY_PATTERN = Pattern.compile("(?i)\\b(topology|nodes?|online|containerized|standalone|running on|unreachable|environment|infra|infrastructure|cluster|health|healthy|status)\\b");
    private static final Pattern AUDIT_PATTERN = Pattern.compile("(?i)\\b(access|permissions?|audit|rbac|who|users?|roles?)\\b");
    private static final Pattern ANALYTICAL_PATTERN = Pattern.compile("(?i)\\b(compare|trend|least stable|most resources|improving)\\b");
    
    private static final Pattern OUT_OF_SCOPE_PATTERN = Pattern.compile("(?i)\\b(weather|joke|fix my code|python script|write code)\\b");
    private static final Pattern CONVERSATIONAL_PATTERN = Pattern.compile("(?i)\\b(hello|hi|hey|greetings|good morning|good afternoon|good evening|who are you|what is your name|help|commands|features|how to use|what can you do)\\b");

    private final EnvironmentRepository environmentRepository;
    private final ApplicationRepository applicationRepository;

    public IntentClassifier(EnvironmentRepository environmentRepository, ApplicationRepository applicationRepository) {
        this.environmentRepository = environmentRepository;
        this.applicationRepository = applicationRepository;
    }

    public Intent classifyIntent(String query) {
        if (query == null || query.isBlank()) {
            return Intent.AMBIGUOUS_CLARIFY;
        }

        if (OUT_OF_SCOPE_PATTERN.matcher(query).find()) {
            return Intent.OUT_OF_SCOPE;
        }

        if (CONVERSATIONAL_PATTERN.matcher(query).find()) {
            return Intent.CONVERSATIONAL;
        }

        Intent baseIntent = determineBaseIntent(query);

        // If it requires environment/app but both are missing, clarify
        if (baseIntent == Intent.METRIC_QUERY || baseIntent == Intent.LOG_SEARCH || baseIntent == Intent.ACTION_REQUEST) {
            String env = extractEnvironment(query);
            String app = extractApplication(query);
            if (env == null && app == null) {
                return Intent.AMBIGUOUS_CLARIFY;
            }
        }

        return baseIntent;
    }

    private Intent determineBaseIntent(String query) {
        if (ACTION_PATTERN.matcher(query).find()) {
            return Intent.ACTION_REQUEST;
        }

        if (SECURITY_PATTERN.matcher(query).find()) {
            return Intent.SECURITY_QUERY;
        }

        if (METRIC_PATTERN.matcher(query).find()) {
            return Intent.METRIC_QUERY;
        }

        if (LOG_PATTERN.matcher(query).find()) {
            return Intent.LOG_SEARCH;
        }

        if (INCIDENT_PATTERN.matcher(query).find()) {
            return Intent.INCIDENT_SUMMARY;
        }

        if (DEPLOYMENT_PATTERN.matcher(query).find()) {
            return Intent.DEPLOYMENT_STATUS;
        }

        if (TOPOLOGY_PATTERN.matcher(query).find()) {
            return Intent.INFRA_TOPOLOGY;
        }

        if (AUDIT_PATTERN.matcher(query).find()) {
            return Intent.USER_AUDIT;
        }

        if (ANALYTICAL_PATTERN.matcher(query).find()) {
            return Intent.ANALYTICAL;
        }

        // Check for ambiguous query based on common short patterns missing context
        if (query.matches("(?i)^(what's the cpu usage\\??|show me the errors\\??|restart the app\\??|is everything okay\\??)$")) {
            return Intent.AMBIGUOUS_CLARIFY;
        }

        return Intent.GENERAL_QUERY;
    }

    public boolean requiresAiSummary(String query) {
        if (query == null) return false;
        String lowerQuery = query.toLowerCase();
        
        // Keywords that explicitly ask for AI processing or summarization
        if (lowerQuery.contains("summarize") || lowerQuery.contains("summary") ||
            lowerQuery.contains("explain") || lowerQuery.contains("analyze") ||
            lowerQuery.contains("analysis") || lowerQuery.contains("compare") ||
            lowerQuery.contains("trend") || lowerQuery.matches(".*\\b(why|how)\\b.*")) {
            return true;
        }
        return false;
    }

    public String extractEnvironment(String query) {
        if (query == null) return null;
        String lowerQuery = query.toLowerCase().replaceAll("[^a-z0-9-_ ]", "");
        
        try {
            List<Environment> envs = environmentRepository.findAll();
            // 1. Exact/Full match check
            for (Environment env : envs) {
                String envName = env.getName().toLowerCase();
                if (lowerQuery.contains(envName)) {
                    return env.getName();
                }
            }
            
            // 2. Partial/Word match check (e.g. "demo-cluster" matches "demo-cluster-pre-prod")
            String[] queryWords = lowerQuery.split("[\\s-_]+");
            Environment bestMatch = null;
            int bestScore = 0;
            for (Environment env : envs) {
                String envName = env.getName().toLowerCase();
                int score = 0;
                for (String word : queryWords) {
                    if (word.length() >= 4 && envName.contains(word)) {
                        // Skip matching generic keywords if they aren't the exact env name
                        if ((word.equals("prod") || word.equals("stage") || word.equals("node") || word.equals("cluster")) && !envName.equals(word)) {
                            continue;
                        }
                        score++;
                    }
                }
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = env;
                }
            }
            if (bestMatch != null) {
                return bestMatch.getName();
            }
        } catch (Exception e) {
            // fallback
        }
        
        if (lowerQuery.contains("production") || lowerQuery.contains("prod")) {
            return "production";
        }
        if (lowerQuery.contains("staging") || lowerQuery.contains("stage")) {
            return "staging";
        }
        if (lowerQuery.contains("dev")) {
            return "development";
        }
        return null;
    }

    public String extractApplication(String query) {
        if (query == null) return null;
        String lowerQuery = query.toLowerCase().replaceAll("[^a-z0-9-_ ]", "");
        
        try {
            List<Application> apps = applicationRepository.findAll();
            // 1. Exact/Full match check
            for (Application app : apps) {
                String appName = app.getName().toLowerCase();
                if (lowerQuery.contains(appName)) {
                    return app.getName();
                }
            }
            
            // 2. Partial match check
            String[] queryWords = lowerQuery.split("[\\s-_]+");
            Application bestMatch = null;
            int bestScore = 0;
            for (Application app : apps) {
                String appName = app.getName().toLowerCase();
                int score = 0;
                for (String word : queryWords) {
                    if (word.length() >= 4 && appName.contains(word)) {
                        score++;
                    }
                }
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = app;
                }
            }
            if (bestMatch != null) {
                return bestMatch.getName();
            }
        } catch (Exception e) {
            // fallback
        }
        
        // Simplified entity extraction based on common patterns
        if (lowerQuery.contains("backend")) return "backend";
        if (lowerQuery.contains("frontend")) return "frontend";
        if (lowerQuery.contains("payment")) return "payment-service";
        if (lowerQuery.contains("checkout")) return "checkout-service";
        return null;
    }
}
