package com.monetique.eye.service;

import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

@Component
public class IntentClassifier {

    private static final Pattern ACTION_PATTERN = Pattern.compile("(?i)\\b(restart|deploy|silence|acknowledge|resolve|create ticket|add node)\\b");
    private static final Pattern SECURITY_PATTERN = Pattern.compile("(?i)\\b(security|cve|vulnerability|falco|dependency-check|scan|suspicious|posture)\\b");
    private static final Pattern METRIC_PATTERN = Pattern.compile("(?i)\\b(cpu|memory|disk|latency|response time|network load|usage|p95)\\b");
    private static final Pattern LOG_PATTERN = Pattern.compile("(?i)\\b(logs?|errors?|warn|search|exception|trace|spike in logs)\\b");
    private static final Pattern INCIDENT_PATTERN = Pattern.compile("(?i)\\b(alerts?|incidents?|root cause|mttr|firing|resolved)\\b");
    private static final Pattern DEPLOYMENT_PATTERN = Pattern.compile("(?i)\\b(deployment|rollback|version|ci/cd|release)\\b");
    private static final Pattern TOPOLOGY_PATTERN = Pattern.compile("(?i)\\b(topology|nodes?|online|containerized|standalone|running on|unreachable)\\b");
    private static final Pattern AUDIT_PATTERN = Pattern.compile("(?i)\\b(access|permissions?|audit|rbac|who)\\b");
    private static final Pattern ANALYTICAL_PATTERN = Pattern.compile("(?i)\\b(compare|trend|least stable|most resources|improving)\\b");
    
    private static final Pattern OUT_OF_SCOPE_PATTERN = Pattern.compile("(?i)\\b(weather|joke|fix my code|python script|write code)\\b");
    private static final Pattern CONVERSATIONAL_PATTERN = Pattern.compile("(?i)\\b(hello|hi|hey|greetings|good morning|good afternoon|good evening|who are you|what is your name|help|commands|features|how to use|what can you do)\\b");

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

    public String extractEnvironment(String query) {
        if (query.toLowerCase().contains("production") || query.toLowerCase().contains("prod")) {
            return "production";
        }
        if (query.toLowerCase().contains("staging") || query.toLowerCase().contains("stage")) {
            return "staging";
        }
        if (query.toLowerCase().contains("dev")) {
            return "development";
        }
        return null;
    }

    public String extractApplication(String query) {
        // Simplified entity extraction based on common patterns
        if (query.toLowerCase().contains("backend")) return "backend";
        if (query.toLowerCase().contains("frontend")) return "frontend";
        if (query.toLowerCase().contains("payment")) return "payment-service";
        if (query.toLowerCase().contains("checkout")) return "checkout-service";
        return null;
    }
}
