package com.monetique.eye.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.Conversation;
import com.monetique.eye.entity.Environment;
import com.monetique.eye.entity.Ticket;
import com.monetique.eye.entity.User;
import com.monetique.eye.entity.enums.TicketStatus;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.ConversationRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.repository.TicketRepository;
import com.monetique.eye.repository.DeploymentLogRepository;
import com.monetique.eye.repository.DeploymentEventRepository;
import com.monetique.eye.repository.ManagedNodeRepository;
import com.monetique.eye.repository.UserRepository;
import com.monetique.eye.repository.ActivityLogRepository;
import com.monetique.eye.security.service.SecurityReportService;
import com.monetique.eye.security.entity.enums.VulnerabilityStatus;
import com.monetique.eye.entity.ManagedNode;
import com.monetique.eye.entity.ActivityLog;
import com.monetique.eye.repository.IncidentRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Service
public class AiChatService {

    private final GroqService groqService;
    private final IntentClassifier intentClassifier;
    private final EnvironmentRepository environmentRepository;
    private final ApplicationRepository applicationRepository;
    private final TicketRepository ticketRepository;
    private final DeploymentLogRepository deploymentLogRepository;
    private final DeploymentEventRepository deploymentEventRepository;
    private final ManagedNodeRepository managedNodeRepository;
    private final UserRepository userRepository;
    private final ActivityLogRepository activityLogRepository;
    private final SecurityReportService securityReportService;
    private final AnomalyService anomalyService;
    private final PrometheusClient prometheusClient;
    private final ElasticsearchLogService esLogService;
    private final ConversationRepository conversationRepository;
    private final DeploymentService deploymentService;
    private final IncidentRepository incidentRepository;
    private final RootCauseIntelligenceService rootCauseIntelligenceService;
    private final ObjectMapper objectMapper;
    
    // In-memory state management for action confirmations
    private final Map<Long, PendingAction> pendingActions = new ConcurrentHashMap<>();

    public AiChatService(GroqService groqService,
                        IntentClassifier intentClassifier,
                        EnvironmentRepository environmentRepository,
                        ApplicationRepository applicationRepository,
                        TicketRepository ticketRepository,
                        DeploymentLogRepository deploymentLogRepository,
                        DeploymentEventRepository deploymentEventRepository,
                        ManagedNodeRepository managedNodeRepository,
                        UserRepository userRepository,
                        ActivityLogRepository activityLogRepository,
                        SecurityReportService securityReportService,
                        AnomalyService anomalyService,
                        PrometheusClient prometheusClient,
                        ElasticsearchLogService esLogService,
                        ConversationRepository conversationRepository,
                        DeploymentService deploymentService,
                        IncidentRepository incidentRepository,
                        RootCauseIntelligenceService rootCauseIntelligenceService,
                        ObjectMapper objectMapper) {
        this.groqService = groqService;
        this.intentClassifier = intentClassifier;
        this.environmentRepository = environmentRepository;
        this.applicationRepository = applicationRepository;
        this.ticketRepository = ticketRepository;
        this.deploymentLogRepository = deploymentLogRepository;
        this.deploymentEventRepository = deploymentEventRepository;
        this.managedNodeRepository = managedNodeRepository;
        this.userRepository = userRepository;
        this.activityLogRepository = activityLogRepository;
        this.securityReportService = securityReportService;
        this.anomalyService = anomalyService;
        this.prometheusClient = prometheusClient;
        this.esLogService = esLogService;
        this.conversationRepository = conversationRepository;
        this.deploymentService = deploymentService;
        this.incidentRepository = incidentRepository;
        this.rootCauseIntelligenceService = rootCauseIntelligenceService;
        this.objectMapper = objectMapper;
    }

    public String processQuery(String query) {
        return processQueryWithConversation(null, query, null);
    }

    public String processQueryWithConversation(Long conversationId, String query, User user) {
        Conversation conversation = null;
        List<Map<String, String>> history = new ArrayList<>();

        if (conversationId != null) {
            conversation = conversationRepository.findById(conversationId).orElse(null);
        }

        if (conversation == null && user != null) {
            conversation = Conversation.builder()
                    .user(user)
                    .messagesJson("[]")
                    .startedAt(LocalDateTime.now())
                    .build();
            conversation = conversationRepository.save(conversation);
        }
        
        Long activeConversationId = conversation != null ? conversation.getId() : -1L;

        if (conversation != null && conversation.getMessagesJson() != null) {
            try {
                history = objectMapper.readValue(conversation.getMessagesJson(), new TypeReference<List<Map<String, String>>>() {});
            } catch (Exception e) {
                history = new ArrayList<>();
            }
        }
        
        // 1. Check for Pending Action Confirmations
        PendingAction pendingAction = pendingActions.get(activeConversationId);
        if (pendingAction != null && !pendingAction.isExpired()) {
            if (query.trim().equalsIgnoreCase("yes") || query.toLowerCase().contains("confirm")) {
                pendingActions.remove(activeConversationId);
                String result;
                Application app = null;
                if (pendingAction.getApplicationId() != null) {
                    app = applicationRepository.findById(pendingAction.getApplicationId()).orElse(null);
                }
                if (app == null && pendingAction.getTargetApp() != null) {
                    app = applicationRepository.findAll().stream()
                            .filter(a -> a.getName().equalsIgnoreCase(pendingAction.getTargetApp()))
                            .findFirst().orElse(null);
                }
                
                if (app != null) {
                    deploymentService.restartApplicationFull(app.getId());
                    result = "✅ Restart action initiated successfully for application **" + app.getName() + 
                             "** in the **" + pendingAction.getTargetEnv() + "** environment. Check deployment logs for progress.";
                } else {
                    result = "⚠️ Could not execute action: Application '" + pendingAction.getTargetApp() + "' not found.";
                }
                updateHistory(conversation, history, query, result);
                return result;
            } else if (query.trim().equalsIgnoreCase("no") || query.toLowerCase().contains("cancel")) {
                pendingActions.remove(activeConversationId);
                String result = "Action cancelled.";
                updateHistory(conversation, history, query, result);
                return result;
            }
            // If they didn't say yes/no, we remove pending and proceed as normal
            pendingActions.remove(activeConversationId);
        }

        // 2. Classify Intent
        Intent intent = intentClassifier.classifyIntent(query, history);
        
        // Handle explicit fallbacks
        if (intent == Intent.OUT_OF_SCOPE) {
            String fallback = "I am Monetique Eye's specialized infrastructure and observability assistant. I can help you analyze logs, check metrics, review security postures, and manage deployments. For general questions, please use a standard AI assistant.";
            updateHistory(conversation, history, query, fallback);
            return fallback;
        }
        
        if (intent == Intent.AMBIGUOUS_CLARIFY) {
            String fallback = "I need a bit more specific information to help with that. Could you clarify which Environment (e.g., staging, production) or Application you are referring to?";
            updateHistory(conversation, history, query, fallback);
            return fallback;
        }
        
        if (intent == Intent.CONVERSATIONAL) {
            String lowercaseQuery = query.toLowerCase();
            String responseText;
            if (lowercaseQuery.contains("help") || lowercaseQuery.contains("what can you do") || lowercaseQuery.contains("features") || lowercaseQuery.contains("commands") || lowercaseQuery.contains("how to use")) {
                responseText = """
                        Hello! I am **Monetique Eye AI**, your enterprise observability and AI ops assistant. 
                        
                        Here is what I can help you with:
                        - **Infrastructure Status**: Ask me about active environments, managed nodes, or application topology (e.g., *"Show me staging topology"*).
                        - **Metrics Analysis**: Ask for CPU/memory metrics (e.g., *"What is the CPU usage on production?"*).
                        - **Log Searches**: Search Elasticsearch application logs (e.g., *"Search for Exception logs in staging"*).
                        - **Security Posture**: Review vulnerabilities or runtime Falco events (e.g., *"Show security summary for production"* or *"Any vulnerabilities on staging?"*).
                        - **Deployment Monitoring**: Check recent deployment events and history (e.g., *"What deployments occurred recently?"*).
                        - **Actions**: Trigger actions like restarting applications directly (e.g., *"Restart frontend in production"*).
                        
                        How can I help you today?
                        """;
            } else {
                responseText = "Hello! I am **Monetique Eye AI**, your observability assistant. How can I help you today? You can ask me about system topology, logs, metrics, deployments, or security posture.";
            }
            updateHistory(conversation, history, query, responseText);
            return responseText;
        }
        
        // Extract targets with contextual resolution
        String targetEnv = intentClassifier.extractEnvironment(query);
        String targetApp = intentClassifier.extractApplication(query);
        
        if (targetEnv == null || targetApp == null) {
            IntentClassifier.ResolvedContext resolved = intentClassifier.resolveFromHistory(query, history);
            if (targetEnv == null) targetEnv = resolved.environment();
            if (targetApp == null) targetApp = resolved.application();
        }
        
        // Handle Actions
        if (intent == Intent.ACTION_REQUEST) {
            if (targetApp == null || targetEnv == null) {
                String fallback = "To perform an action, I need both the target Application and Environment. Could you clarify?";
                updateHistory(conversation, history, query, fallback);
                return fallback;
            }
            
            Long appId = null;
            Application app = applicationRepository.findAll().stream()
                    .filter(a -> a.getName().equalsIgnoreCase(targetApp))
                    .findFirst().orElse(null);
            if (app != null) {
                appId = app.getId();
            }
            
            pendingActions.put(activeConversationId, new PendingAction("RESTART", targetApp, targetEnv, appId));
            String response = "You have requested to perform an action on the **" + targetApp + "** application in the **" + targetEnv + "** environment. Please reply with 'Yes' to confirm execution.";
            updateHistory(conversation, history, query, response);
            return response;
        }

        // 3. Gather Targeted Context based on Intent with Call Guardrail
        AtomicInteger externalCallsCount = new AtomicInteger(0);
        String context = gatherTargetedContext(intent, query, targetEnv, targetApp, externalCallsCount);

        // Always use the AI to generate a presentable summary and response from the gathered context

        // 4. Build History String for Prompt
        StringBuilder historySb = new StringBuilder();
        if (!history.isEmpty()) {
            historySb.append("\nPREVIOUS CONVERSATION HISTORY:\n");
            for (Map<String, String> msg : history.stream().skip(Math.max(0, history.size() - 6)).collect(Collectors.toList())) {
                historySb.append(String.format("%s: %s\n", msg.get("role").toUpperCase(), msg.get("content")));
            }
        }

        // Build Role Instruction
        String roleInstruction = "";
        if (user != null && user.getRole() != null) {
            if (user.getRole() == com.monetique.eye.entity.enums.Role.ADMIN) {
                roleInstruction = "- The operator is an Administrator/SRE. Include technical details, diagnostic instructions, and potential terminal commands or actions where useful.\n";
            } else {
                roleInstruction = "- The operator is a standard User/Manager. Translate technical jargon into clear, plain business language.\n";
            }
        }

        // 5. Build Prompt
        String prompt = String.format("""
                You are 'Monetique Eye AI', an advanced enterprise infrastructure and observability assistant.
                
                USER INTENT: %s
                
                RELEVANT INFRASTRUCTURE DATA:
                %s
                %s
                
                USER QUERY:
                %s
                
                INSTRUCTIONS:
                - Provide a professional executive-level summary answering the user's question.
                %s- Start with a brief 1-2 sentence status overview (e.g., "Your Demo-cluster environment is healthy with no critical issues detected.").
                - Then present the key findings using **bold** labels and bullet points.
                - Highlight any warnings, errors, or risks with ⚠️ markers and explain what they mean.
                - If everything is healthy, explicitly confirm that with ✅.
                - End with a brief recommendation if applicable.
                - Use markdown formatting: **bold** for labels, bullet points for lists, `code` for technical values.
                - Keep the response concise but informative (3-8 sentences max).
                - Do NOT just repeat the raw data — interpret it and provide actionable insights.
                - If data for part of the question is missing, say so explicitly rather than omitting it silently.
                - Never fabricate metrics or statistics. If no data is available, say 'No data available'.
                """, intent.name(), context, historySb.toString(), query, roleInstruction);

        // 6. Call Groq
        String response = groqService.generateSummary(prompt);

        // Fallback: If Groq failed or was rate limited, generate a smart local summary
        if (response != null && (response.contains("rate limit reached") || response.contains("unavailable") || response.contains("Error:"))) {
            if (context != null && !context.isBlank()) {
                response = generateLocalSummary(intent, query, context);
            }
        }

        // 7. Update History
        updateHistory(conversation, history, query, response);

        return response;
    }
    
    private void updateHistory(Conversation conversation, List<Map<String, String>> history, String query, String response) {
        if (conversation != null) {
            history.add(Map.of("role", "user", "content", query));
            history.add(Map.of("role", "assistant", "content", response));
            try {
                conversation.setMessagesJson(objectMapper.writeValueAsString(history));
                conversationRepository.save(conversation);
            } catch (Exception e) {
                // Log error
            }
        }
    }

    private String generateLocalSummary(Intent intent, String query, String context) {
        StringBuilder sb = new StringBuilder();
        
        sb.append("*Note: The AI summarization service is currently busy. Below is the structured local status retrieved for your request:* \n\n");
        
        boolean hasErrors = context.contains("[ERROR]");
        int errorCount = 0;
        
        switch (intent) {
            case INCIDENT_SUMMARY:
                sb.append("## 🚨 Active Incidents & Alerts\n\n");
                if (context.contains("No active firing alerts")) {
                    sb.append("✅ **All Clear**: No active firing alerts or incidents are currently reported on the system.\n");
                } else {
                    sb.append("The following active alerts/tickets require attention:\n\n");
                    String[] lines = context.split("\n");
                    for (String line : lines) {
                        if (line.trim().startsWith("- ")) {
                            sb.append(line.trim()).append("\n");
                        }
                    }
                }
                break;
                
            case LOG_SEARCH:
                sb.append("## 📝 Log Search Results\n\n");
                if (context.contains("No recent logs found")) {
                    sb.append("ℹ️ No matching log entries were found for your search query.\n");
                } else {
                    sb.append("Recent matching log entries:\n\n");
                    String[] lines = context.split("\n");
                    for (String line : lines) {
                        if (line.trim().startsWith("- ")) {
                            sb.append(line.trim()).append("\n");
                        }
                    }
                }
                break;
                
            case DEPLOYMENT_STATUS:
                sb.append("## 🚀 Deployment Status\n\n");
                String[] depLines = context.split("\n");
                for (String line : depLines) {
                    if (line.trim().startsWith("- ") || line.trim().startsWith("* ") || line.trim().startsWith("  - ")) {
                        sb.append(line.trim()).append("\n");
                    }
                }
                break;
                
            case SECURITY_QUERY:
                sb.append("## 🛡️ Security Audit & Posture\n\n");
                String[] secLines = context.split("\n");
                for (String line : secLines) {
                    if (line.trim().startsWith("- ") || line.trim().startsWith("* ") || line.trim().startsWith("  - ") || line.trim().startsWith("    * ")) {
                        sb.append(line.trim()).append("\n");
                    }
                }
                break;
                
            case USER_AUDIT:
                sb.append("## 👥 User Access & RBAC Audit\n\n");
                String[] auditLines = context.split("\n");
                for (String line : auditLines) {
                    if (line.trim().startsWith("- ") || line.trim().startsWith("* ") || line.trim().startsWith("  - ")) {
                        sb.append(line.trim()).append("\n");
                    }
                }
                break;

            case ANOMALY_QUERY:
                sb.append("## 🔍 Statistical Anomalies & Unusual Behavior\n\n");
                if (context.contains("No system anomalies")) {
                    sb.append("✅ **All Clear**: No significant resource or log-volume anomalies detected.\n");
                } else {
                    sb.append("The following anomalous signals were detected in the system:\n\n");
                    String[] lines = context.split("\n");
                    for (String line : lines) {
                        if (line.trim().startsWith("- ")) {
                            sb.append(line.trim()).append("\n");
                        }
                    }
                }
                break;
                
            case ROOT_CAUSE_QUERY:
                sb.append("## 🕵️ Root Cause Intelligence Analysis\n\n");
                if (context.contains("No clear root causes")) {
                    sb.append("ℹ️ Rule correlation was unable to isolate a specific single root cause category. Check active alerts.\n");
                } else {
                    sb.append("Here are the top ranked root cause hypotheses based on active signals:\n\n");
                    String[] lines = context.split("\n");
                    for (String line : lines) {
                        if (line.trim().startsWith("- ") || line.trim().startsWith("  *") || line.trim().startsWith("    -")) {
                            sb.append(line.trim()).append("\n");
                        }
                    }
                }
                break;
                
            case ANALYTICAL:
                sb.append("## 📊 Observability Analytical Report\n\n");
                String[] analLines = context.split("\n");
                for (String line : analLines) {
                    if (line.trim().startsWith("- ") || line.trim().startsWith("  *") || line.trim().startsWith("####")) {
                        sb.append(line.trim()).append("\n");
                    }
                }
                break;

            case METRIC_QUERY:
            case INFRA_TOPOLOGY:
            case GENERAL_QUERY:
            default:
                boolean hasWarnings = context.contains("[WARN]") || context.contains("warnings detected");
                boolean hasNoIssues = context.contains("No significant errors") || context.contains("No recent logs found") || context.contains("No active firing alerts");
                
                // Extract CPU/RAM if present
                String cpuValue = extractMetricValue(context, "CPU Usage");
                String ramValue = extractMetricValue(context, "RAM Usage");
                
                // Extract environment name
                String envName = extractFieldValue(context, "Env:");
                
                // Count errors and warnings
                int warningCount = 0;
                try {
                    java.util.regex.Matcher m = java.util.regex.Pattern.compile("(\\d+) errors? and (\\d+) warnings?").matcher(context);
                    if (m.find()) {
                        errorCount = Integer.parseInt(m.group(1));
                        warningCount = Integer.parseInt(m.group(2));
                    }
                } catch (Exception ignored) {}
                
                // Build status overview
                sb.append("## 📋 Status Summary");
                if (envName != null) {
                    sb.append(" — ").append(envName);
                }
                sb.append("\n\n");
                
                // Health assessment
                if (hasErrors || errorCount > 0) {
                    sb.append("⚠️ **Warning**: Issues detected in your environment that require attention.\n\n");
                } else if (hasNoIssues || (!hasErrors && errorCount == 0)) {
                    sb.append("✅ **All Clear**: Your environment appears healthy with no critical issues detected.\n\n");
                } else {
                    sb.append("ℹ️ **Status**: Environment is operational.\n\n");
                }
                
                // Metrics summary
                if (cpuValue != null || ramValue != null) {
                    sb.append("### 📊 Resource Utilization\n");
                    if (cpuValue != null) {
                        double cpu = 0;
                        try { cpu = Double.parseDouble(cpuValue.replace("%", "")); } catch (Exception e) {}
                        String cpuStatus = cpu > 80 ? "🔴 Critical" : cpu > 60 ? "🟡 Elevated" : "🟢 Normal";
                        sb.append(String.format("- **CPU**: `%s` — %s\n", cpuValue, cpuStatus));
                    }
                    if (ramValue != null) {
                        double ram = 0;
                        try { ram = Double.parseDouble(ramValue.replace("%", "")); } catch (Exception e) {}
                        String ramStatus = ram > 85 ? "🔴 Critical" : ram > 70 ? "🟡 Elevated" : "🟢 Normal";
                        sb.append(String.format("- **RAM**: `%s` — %s\n", ramValue, ramStatus));
                    }
                    sb.append("\n");
                }
                
                // Error/Warning summary
                if (errorCount > 0 || warningCount > 0) {
                    sb.append("### ⚠️ Issues Detected\n");
                    sb.append(String.format("- **%d error(s)** and **%d warning(s)** found in recent logs.\n", errorCount, warningCount));
                    
                    // Extract specific error summaries from context
                    String[] lines = context.split("\n");
                    int issueCount = 0;
                    for (String line : lines) {
                        if ((line.contains("[ERROR]") || line.contains("[WARN]")) && issueCount < 3) {
                            String cleaned = line.replaceAll("^[-*\\s]+", "").trim();
                            if (cleaned.length() > 150) cleaned = cleaned.substring(0, 147) + "...";
                            sb.append(String.format("  - %s\n", cleaned));
                            issueCount++;
                        }
                    }
                    sb.append("\n");
                } else {
                    sb.append("### ✅ Logs & Alerts\n");
                    sb.append("- No errors or warnings detected in recent logs.\n\n");
                }
                
                // Topology info
                if (context.contains("Managed Nodes:") || context.contains("Deployed Applications:") || context.contains("active environments:")) {
                    sb.append("### 🏗️ Infrastructure\n");
                    String[] lines = context.split("\n");
                    for (String line : lines) {
                        if (line.contains("Managed Nodes:") || line.contains("Deployed Applications:") || line.contains("active environments:")) {
                            sb.append("- ").append(line.replaceAll("^[-*\\s]+", "").trim()).append("\n");
                        }
                        if (line.trim().startsWith("* ") || (line.contains("Role:") || line.contains("Status:"))) {
                            String cleaned = line.replaceAll("^[\\s*]+", "").trim();
                            sb.append("  - ").append(cleaned).append("\n");
                        }
                    }
                    sb.append("\n");
                }
                break;
        }
        
        // Recommendation
        sb.append("---\n");
        if (intent == Intent.INCIDENT_SUMMARY) {
            if (context.contains("No active firing alerts")) {
                sb.append("💡 **Recommendation**: No immediate action required. System is stable.");
            } else {
                sb.append("💡 **Recommendation**: Acknowledge the active alerts in Alertmanager and check the service health status.");
            }
        } else if (hasErrors || errorCount > 0) {
            sb.append("💡 **Recommendation**: Review the error logs above. Consider checking the affected services for connectivity or configuration issues.");
        } else {
            sb.append("💡 **Recommendation**: No immediate action required. Continue monitoring for any changes.");
        }
        
        return sb.toString();
    }
    
    private String extractMetricValue(String context, String metricName) {
        try {
            int idx = context.indexOf(metricName);
            if (idx == -1) return null;
            String after = context.substring(idx + metricName.length());
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("[:\\s]*([\\d.]+%)").matcher(after);
            if (m.find()) return m.group(1);
        } catch (Exception e) {}
        return null;
    }
    
    private String extractFieldValue(String context, String fieldName) {
        try {
            int idx = context.indexOf(fieldName);
            if (idx == -1) return null;
            String after = context.substring(idx + fieldName.length());
            int lineEnd = after.indexOf("\n");
            if (lineEnd == -1) lineEnd = after.length();
            String value = after.substring(0, lineEnd).trim();
            // Remove parenthetical cluster info
            int parenIdx = value.indexOf("(");
            if (parenIdx > 0) value = value.substring(0, parenIdx).trim();
            return value;
        } catch (Exception e) {}
        return null;
    }
    
    private String extractBetween(String text, String start, String end) {
        try {
            int s = text.indexOf(start);
            int e = text.indexOf(end);
            if (s >= 0 && e > s) return text.substring(s + start.length(), e).trim();
        } catch (Exception ex) {}
        return null;
    }

    private boolean checkExternalCallsLimit(AtomicInteger externalCalls, StringBuilder sb) {
        if (externalCalls.incrementAndGet() > 6) {
            if (sb.indexOf("⚠️ Query complexity limit reached") == -1) {
                sb.append("\n⚠️ Query complexity limit reached. Some data sources were skipped.\n");
            }
            return false;
        }
        return true;
    }

    private String gatherTargetedContext(Intent intent, String query, String targetEnv, String targetApp, AtomicInteger externalCallsCount) {
        StringBuilder sb = new StringBuilder();

        // Only fetch what is needed based on Intent
        switch (intent) {
            case METRIC_QUERY:
                sb.append("### 📊 Metrics & Performance\n");
                if (targetEnv != null) {
                    Environment env = environmentRepository.findAll().stream().filter(e -> e.getName().equalsIgnoreCase(targetEnv)).findFirst().orElse(null);
                    if (env != null) {
                        String envLabel = env.getPrometheusLabel() != null ? env.getPrometheusLabel() : env.getName().toLowerCase();
                        Double cpu = 0.0;
                        Double ram = 0.0;
                        if (checkExternalCallsLimit(externalCallsCount, sb)) {
                            cpu = prometheusClient.getCpuUsage(envLabel);
                        }
                        if (checkExternalCallsLimit(externalCallsCount, sb)) {
                            ram = prometheusClient.getMemoryUsagePercent(envLabel);
                        }
                        sb.append(String.format("- Env %s CPU: %.1f%%, RAM: %.1f%%\n", env.getName(), cpu, ram));
                    }
                } else {
                    sb.append("Please specify an environment to get accurate metrics.\n");
                }
                break;
                
            case LOG_SEARCH:
                sb.append("### 📝 Recent Logs\n");
                if (targetEnv != null) {
                    if (checkExternalCallsLimit(externalCallsCount, sb)) {
                        List<Map<String, Object>> logs = esLogService.getRecentLogs(targetEnv.toLowerCase(), 10);
                        if (!logs.isEmpty()) {
                            for (Map<String, Object> log : logs) {
                                Object msg = log.get("raw_message") != null ? log.get("raw_message") : log.get("message");
                                sb.append(String.format("- **[%s] %s**: %s\n", log.get("severity"), log.get("service_name"), msg));
                            }
                        } else {
                            sb.append("- No recent logs found for environment: " + targetEnv + "\n");
                        }
                    }
                }
                break;
                
            case INCIDENT_SUMMARY:
                sb.append("### ⚠️ Active Incident History & Alerts\n");
                List<com.monetique.eye.entity.Incident> activeIncidents = incidentRepository.findWithFilters(
                        com.monetique.eye.entity.enums.IncidentStatus.OPEN, null, null, PageRequest.of(0, 5));
                if (activeIncidents != null && !activeIncidents.isEmpty()) {
                    for (com.monetique.eye.entity.Incident inc : activeIncidents) {
                        sb.append(String.format("- **[Incident #%d] %s** (%s, %s, Created: %s):\n", 
                                inc.getId(), inc.getTitle(), inc.getSeverity(), inc.getStatus(), inc.getCreatedAt()));
                        if (inc.getAiSummary() != null && !inc.getAiSummary().isBlank()) {
                            sb.append("  * AI Summary: ").append(inc.getAiSummary()).append("\n");
                        }
                    }
                } else {
                    sb.append("- No active incidents found in database.\n");
                }

                List<Ticket> openTickets = ticketRepository.findAll().stream()
                        .filter(t -> t.getStatus() == TicketStatus.OPEN)
                        .limit(5)
                        .collect(Collectors.toList());
                if (!openTickets.isEmpty()) {
                    sb.append("  - Active Alerts:\n");
                    for (Ticket t : openTickets) {
                        sb.append(String.format("    * [%s] %s: %s\n", t.getPriority(), t.getTitle(), t.getDescription()));
                    }
                } else if (activeIncidents == null || activeIncidents.isEmpty()) {
                    sb.append("- ✅ No active firing alerts or incidents.\n");
                }
                break;
                
            case ANOMALY_QUERY:
                sb.append("### 🔍 System Anomalies & Unusual Behavior\n");
                if (targetEnv != null) {
                    Environment env = environmentRepository.findAll().stream()
                            .filter(e -> e.getName().equalsIgnoreCase(targetEnv))
                            .findFirst().orElse(null);
                    if (env != null) {
                        List<com.monetique.eye.dto.AnomalyResponse> anomalies = anomalyService.getRecentAnomalies(env.getId());
                        if (anomalies != null && !anomalies.isEmpty()) {
                            for (var anomaly : anomalies) {
                                sb.append(String.format("- **[%s] %s** (Node: %s, Type: %s, at %s)\n",
                                        anomaly.getSeverity(), anomaly.getDescription(), 
                                        anomaly.getNode() != null ? anomaly.getNode() : "unknown",
                                        anomaly.getType(), anomaly.getTimestamp()));
                            }
                        } else {
                            sb.append("- ✅ No system anomalies or unusual behaviors detected in the last window.\n");
                        }
                    } else {
                        sb.append("- Environment '").append(targetEnv).append("' not found.\n");
                    }
                } else {
                    sb.append("Please specify an environment to scan for anomalies.\n");
                }
                break;

            case ROOT_CAUSE_QUERY:
                sb.append("### 🕵️ Root Cause Intelligence Analysis\n");
                if (targetEnv != null) {
                    Environment env = environmentRepository.findAll().stream()
                            .filter(e -> e.getName().equalsIgnoreCase(targetEnv))
                            .findFirst().orElse(null);
                    if (env != null) {
                        String envLabel = env.getPrometheusLabel() != null ? env.getPrometheusLabel() : env.getName().toLowerCase();
                        if (checkExternalCallsLimit(externalCallsCount, sb)) {
                            var rules = rootCauseIntelligenceService.analyze(
                                    envLabel, 
                                    targetApp, 
                                    null, 
                                    java.time.Instant.now().minus(2, java.time.temporal.ChronoUnit.HOURS), 
                                    java.time.Instant.now());
                            if (rules != null && !rules.isEmpty()) {
                                for (var rule : rules) {
                                    sb.append(String.format("- **%s** (Confidence: %s, Probability: %.1f%%)\n",
                                            rule.getTitle(), rule.getConfidence(), rule.getProbability()));
                                    sb.append("  * Description: ").append(rule.getDescription()).append("\n");
                                    if (rule.getEvidence() != null && !rule.getEvidence().isEmpty()) {
                                        sb.append("  * Evidence:\n");
                                        for (String ev : rule.getEvidence()) {
                                            sb.append("    - ").append(ev).append("\n");
                                        }
                                    }
                                }
                            } else {
                                sb.append("- No clear root causes could be classified by rule correlation.\n");
                            }
                        }
                    } else {
                        sb.append("- Environment '").append(targetEnv).append("' not found.\n");
                    }
                } else {
                    sb.append("Please specify an environment to perform root cause analysis.\n");
                }
                break;

            case ANALYTICAL:
                sb.append("### 📊 Analytical & Comparison Report\n");
                List<String> envs = intentClassifier.extractEnvironments(query);
                List<String> apps = intentClassifier.extractApplications(query);
                
                boolean isTrendQuery = query.toLowerCase().contains("trend") || query.toLowerCase().contains("over time") || query.toLowerCase().contains("improving") || query.toLowerCase().contains("stable");
                
                if (isTrendQuery && targetEnv != null) {
                    Environment env = environmentRepository.findAll().stream()
                            .filter(e -> e.getName().equalsIgnoreCase(targetEnv))
                            .findFirst().orElse(null);
                    if (env != null) {
                        String envLabel = env.getPrometheusLabel() != null ? env.getPrometheusLabel() : env.getName().toLowerCase();
                        sb.append(String.format("- **Environment**: %s\n", env.getName()));
                        
                        Double cpuNow = 0.0;
                        Double cpuHourAgo = 0.0;
                        Double ramNow = 0.0;
                        Double ramHourAgo = 0.0;
                        
                        if (checkExternalCallsLimit(externalCallsCount, sb)) {
                            cpuNow = prometheusClient.getCpuUsage(envLabel);
                        }
                        if (checkExternalCallsLimit(externalCallsCount, sb)) {
                            cpuHourAgo = prometheusClient.getCpuUsage(envLabel, java.time.Instant.now().minus(1, java.time.temporal.ChronoUnit.HOURS));
                        }
                        if (checkExternalCallsLimit(externalCallsCount, sb)) {
                            ramNow = prometheusClient.getMemoryUsagePercent(envLabel);
                        }
                        if (checkExternalCallsLimit(externalCallsCount, sb)) {
                            ramHourAgo = prometheusClient.getMemoryUsagePercent(envLabel, java.time.Instant.now().minus(1, java.time.temporal.ChronoUnit.HOURS));
                        }
                        
                        sb.append(String.format("  * CPU Usage: %.1f%% (Current) vs %.1f%% (1 hour ago)\n", cpuNow, cpuHourAgo));
                        sb.append(String.format("  * RAM Usage: %.1f%% (Current) vs %.1f%% (1 hour ago)\n", ramNow, ramHourAgo));
                        
                        String cpuTrend = cpuNow > cpuHourAgo + 5.0 ? "trending UP (increased load)" : cpuNow < cpuHourAgo - 5.0 ? "trending DOWN (reduced load)" : "STABLE";
                        String ramTrend = ramNow > ramHourAgo + 5.0 ? "trending UP" : ramNow < ramHourAgo - 5.0 ? "trending DOWN" : "STABLE";
                        sb.append(String.format("  * Resource Direction: CPU is %s, RAM is %s\n", cpuTrend, ramTrend));
                    }
                } else if (envs.size() >= 2) {
                    sb.append("#### Side-by-Side Environment Comparison\n");
                    for (String envName : envs) {
                        Environment env = environmentRepository.findAll().stream()
                                .filter(e -> e.getName().equalsIgnoreCase(envName))
                                .findFirst().orElse(null);
                        if (env != null) {
                            sb.append(String.format("- **Environment: %s**\n", env.getName()));
                            Double cpu = 0.0;
                            Double ram = 0.0;
                            if (checkExternalCallsLimit(externalCallsCount, sb)) {
                                String envLabel = env.getPrometheusLabel() != null ? env.getPrometheusLabel() : env.getName().toLowerCase();
                                cpu = prometheusClient.getCpuUsage(envLabel);
                            }
                            if (checkExternalCallsLimit(externalCallsCount, sb)) {
                                String envLabel = env.getPrometheusLabel() != null ? env.getPrometheusLabel() : env.getName().toLowerCase();
                                ram = prometheusClient.getMemoryUsagePercent(envLabel);
                            }
                            sb.append(String.format("  * CPU Usage: %.1f%%\n  * RAM Usage: %.1f%%\n", cpu, ram));
                            long nodeCount = managedNodeRepository.countByEnvironment(env);
                            long appCount = applicationRepository.findByEnvironmentId(env.getId()).size();
                            sb.append(String.format("  * Managed Nodes: %d, Deployed Applications: %d\n", nodeCount, appCount));
                        }
                    }
                } else if (apps.size() >= 2) {
                    sb.append("#### Side-by-Side Application Comparison\n");
                    for (String appName : apps) {
                        Application app = applicationRepository.findAll().stream()
                                .filter(a -> a.getName().equalsIgnoreCase(appName))
                                .findFirst().orElse(null);
                        if (app != null) {
                            sb.append(String.format("- **Application: %s**\n", app.getName()));
                            sb.append(String.format("  * Status: %s, Port: %s, Target Node: %s\n", app.getStatus(), app.getPort(), app.getTargetNode()));
                            try {
                                var summary = securityReportService.getSummaryForApplication(app.getId());
                                sb.append(String.format("  * Vulnerabilities: %d critical, %d high\n", summary.getCriticalCount(), summary.getHighCount()));
                            } catch (Exception e) {
                                // ignore
                            }
                        }
                    }
                } else {
                    sb.append("To run analytical comparison, please specify 'compare <env1> vs <env2>' or 'compare <app1> vs <app2>'.\n");
                }
                break;

            case SECURITY_QUERY:
                sb.append("### 🛡️ Security Posture\n");
                if (targetApp != null) {
                    Application app = applicationRepository.findAll().stream().filter(a -> a.getName().equalsIgnoreCase(targetApp)).findFirst().orElse(null);
                    if (app != null) {
                        try {
                            var summary = securityReportService.getSummaryForApplication(app.getId());
                            sb.append(String.format("- App: %s\n", app.getName()));
                            sb.append(String.format("  - Critical Vulns: %d, High Vulns: %d, Medium Vulns: %d, Low Vulns: %d\n",
                                    summary.getCriticalCount(), summary.getHighCount(), summary.getMediumCount(), summary.getLowCount()));
                            sb.append(String.format("  - Falco Events (24h): %d\n", summary.getFalcoEventsLast24h()));
                            if (summary.getLatestDependencyScan() != null) {
                                sb.append(String.format("  - Latest Dependency Scan: %s\n", summary.getLatestDependencyScan()));
                            }
                            if (summary.getLatestSonarScan() != null) {
                                sb.append(String.format("  - Latest SonarQube Scan: %s\n", summary.getLatestSonarScan()));
                            }
                            
                            var vulns = securityReportService.getVulnerabilities(app.getId(), null, VulnerabilityStatus.OPEN, null, PageRequest.of(0, 5));
                            if (vulns != null && !vulns.isEmpty()) {
                                sb.append("  - Top Open Vulnerabilities:\n");
                                for (var v : vulns.getContent()) {
                                    sb.append(String.format("    * [%s] %s: %s (Status: %s)\n", v.getSeverity(), v.getIdentifier(), v.getTitle(), v.getStatus()));
                                }
                            }
                        } catch (Exception e) {
                            sb.append("  - Error fetching app security summary: ").append(e.getMessage()).append("\n");
                        }
                    } else {
                        sb.append(String.format("- Application '%s' not found.\n", targetApp));
                    }
                } else if (targetEnv != null) {
                    Environment env = environmentRepository.findAll().stream().filter(e -> e.getName().equalsIgnoreCase(targetEnv)).findFirst().orElse(null);
                    if (env != null) {
                        try {
                            var attackSurface = securityReportService.getAttackSurface(env.getId());
                            sb.append(String.format("- Environment: %s\n", env.getName()));
                            long totalCritical = attackSurface.getNodes().stream().mapToInt(n -> n.getCriticalVulns()).sum();
                            long totalHigh = attackSurface.getNodes().stream().mapToInt(n -> n.getHighVulns()).sum();
                            long totalFalco = attackSurface.getNodes().stream().mapToInt(n -> n.getFalcoEvents24h()).sum();
                            sb.append(String.format("  - Total Critical Vulns: %d, High Vulns: %d\n", totalCritical, totalHigh));
                            sb.append(String.format("  - Total Falco Runtime Alerts (24h): %d\n", totalFalco));
                            
                            var atRiskNodes = attackSurface.getNodes().stream()
                                     .filter(n -> !"HEALTHY".equals(n.getStatus()))
                                     .limit(5)
                                     .toList();
                            if (!atRiskNodes.isEmpty()) {
                                sb.append("  - At-Risk Components:\n");
                                for (var n : atRiskNodes) {
                                    sb.append(String.format("    * Node: %s (%s) - Status: %s, Critical Vulns: %d, High Vulns: %d, Falco Events: %d\n",
                                            n.getLabel(), n.getType(), n.getStatus(), n.getCriticalVulns(), n.getHighVulns(), n.getFalcoEvents24h()));
                                }
                            }
                        } catch (Exception e) {
                            sb.append("  - Error fetching environment security attack surface: ").append(e.getMessage()).append("\n");
                        }
                    } else {
                        sb.append(String.format("- Environment '%s' not found.\n", targetEnv));
                    }
                } else {
                    try {
                        var global = securityReportService.getGlobalSummary();
                        sb.append("- Global Security Posture:\n");
                        sb.append(String.format("  - Critical Vulns: %d, High Vulns: %d, Medium Vulns: %d, Low Vulns: %d\n",
                                global.getCriticalCount(), global.getHighCount(), global.getMediumCount(), global.getLowCount()));
                        sb.append(String.format("  - Falco Events (24h): %d\n", global.getFalcoEventsLast24h()));
                    } catch (Exception e) {
                        sb.append("  - Error fetching global security summary: ").append(e.getMessage()).append("\n");
                    }
                }
                break;
                
            case DEPLOYMENT_STATUS:
                sb.append("### 🚀 Deployment History\n");
                if (targetApp != null) {
                    Application app = applicationRepository.findAll().stream().filter(a -> a.getName().equalsIgnoreCase(targetApp)).findFirst().orElse(null);
                    if (app != null) {
                        sb.append(String.format("- App: %s (Current version: %s)\n", app.getName(), app.getVersion() != null ? app.getVersion() : "unknown"));
                        var eventsPage = deploymentEventRepository.findByApplicationId(app.getId(), PageRequest.of(0, 5));
                        if (eventsPage != null && !eventsPage.isEmpty()) {
                            sb.append("  - Recent Deployment Events:\n");
                            for (var ev : eventsPage.getContent()) {
                                sb.append(String.format("    * Version %s (Build #%s) in Env %s - Status: %s at %s\n",
                                        ev.getVersion(), ev.getBuildNumber(), ev.getEnv(), ev.getStatus(), ev.getStartedAt()));
                            }
                        } else {
                            sb.append("  - No deployment event history found.\n");
                        }
                    } else {
                        sb.append(String.format("- Application '%s' not found.\n", targetApp));
                    }
                } else if (targetEnv != null) {
                    Environment env = environmentRepository.findAll().stream().filter(e -> e.getName().equalsIgnoreCase(targetEnv)).findFirst().orElse(null);
                    if (env != null) {
                        sb.append(String.format("- Environment: %s\n", env.getName()));
                        var logs = deploymentLogRepository.findAll().stream()
                                .filter(l -> l.getEnvironment() != null && l.getEnvironment().getId().equals(env.getId()))
                                .sorted((l1, l2) -> l2.getExecutedAt().compareTo(l1.getExecutedAt()))
                                .limit(5)
                                .toList();
                        if (!logs.isEmpty()) {
                            sb.append("  - Recent Environment Deployment Logs:\n");
                            for (var logEntry : logs) {
                                sb.append(String.format("    * App: %s, Action: %s - Status: %s (Executed by %s at %s)\n",
                                        logEntry.getAppName(), logEntry.getAction(), logEntry.getStatus(),
                                        logEntry.getExecutedBy() != null ? logEntry.getExecutedBy().getUsername() : "system",
                                        logEntry.getExecutedAt()));
                                if (logEntry.getShortError() != null && !logEntry.getShortError().isEmpty()) {
                                    sb.append(String.format("      Error: %s\n", logEntry.getShortError()));
                                }
                            }
                        } else {
                            sb.append("  - No deployment logs found for this environment.\n");
                        }
                    } else {
                        sb.append(String.format("- Environment '%s' not found.\n", targetEnv));
                    }
                } else {
                    var logs = deploymentLogRepository.findAll(PageRequest.of(0, 5, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "executedAt")));
                    if (logs != null && !logs.isEmpty()) {
                        sb.append("- Latest Global Deployments:\n");
                        for (var logEntry : logs.getContent()) {
                            sb.append(String.format("  * App: %s in Env %s, Action: %s - Status: %s (at %s)\n",
                                    logEntry.getAppName(), 
                                    logEntry.getEnvironment() != null ? logEntry.getEnvironment().getName() : "Global",
                                    logEntry.getAction(), logEntry.getStatus(), logEntry.getExecutedAt()));
                        }
                    } else {
                        sb.append("  - No deployment history found.\n");
                    }
                }
                break;
                
            case INFRA_TOPOLOGY:
                sb.append("### 📌 Infrastructure & Topology\n");
                if (targetEnv != null) {
                    Environment env = environmentRepository.findAll().stream().filter(e -> e.getName().equalsIgnoreCase(targetEnv)).findFirst().orElse(null);
                    if (env != null) {
                        sb.append(String.format("- Env: %s (Cluster: %s)\n", env.getName(), env.getCluster() != null ? env.getCluster().getName() : "none"));
                        List<ManagedNode> nodes = managedNodeRepository.findByEnvironment(env);
                        if (!nodes.isEmpty()) {
                            sb.append("  - Managed Nodes:\n");
                            for (ManagedNode node : nodes) {
                                sb.append(String.format("    * %s (%s) - Role: %s\n",
                                        node.getNodeName() != null ? node.getNodeName() : "Unnamed",
                                        node.getIp(),
                                        node.getRole() != null ? node.getRole() : "app"));
                            }
                        } else {
                            sb.append("  - No managed nodes found.\n");
                        }
                        List<Application> envApps = applicationRepository.findByEnvironmentId(env.getId());
                        if (!envApps.isEmpty()) {
                            sb.append("  - Deployed Applications:\n");
                            for (Application a : envApps) {
                                sb.append(String.format("    * %s (Type: %s, Port: %s, Status: %s)\n",
                                        a.getName(), a.getType(), a.getPort(), a.getStatus()));
                            }
                        } else {
                            sb.append("  - No deployed applications found.\n");
                        }
                        
                        sb.append("\n### 📊 Metrics\n");
                        try {
                            String envLabel = env.getPrometheusLabel() != null ? env.getPrometheusLabel() : env.getName().toLowerCase();
                            Double cpu = 0.0;
                            Double ram = 0.0;
                            if (checkExternalCallsLimit(externalCallsCount, sb)) {
                                cpu = prometheusClient.getCpuUsage(envLabel);
                            }
                            if (checkExternalCallsLimit(externalCallsCount, sb)) {
                                ram = prometheusClient.getMemoryUsagePercent(envLabel);
                            }
                            sb.append(String.format("- **CPU Usage**: %.1f%%\n- **RAM Usage**: %.1f%%\n", cpu, ram));
                        } catch (Exception e) {
                            sb.append("- Metrics currently unavailable.\n");
                        }

                        sb.append("\n### ⚠️ Log Issues & Warnings\n");
                        try {
                            if (checkExternalCallsLimit(externalCallsCount, sb)) {
                                java.util.List<java.util.Map<String, Object>> envLogs = esLogService.getRecentLogs(env.getName().toLowerCase(), 20);
                                if (envLogs != null && !envLogs.isEmpty()) {
                                    long errorCount = 0;
                                    long warnCount = 0;
                                    java.util.List<String> problemSummaries = new java.util.ArrayList<>();

                                    for (java.util.Map<String, Object> log : envLogs) {
                                        String severity = log.get("severity") != null ? log.get("severity").toString().toUpperCase() : "INFO";
                                        Object msgObj = log.get("raw_message") != null ? log.get("raw_message") : log.get("message");
                                        String message = msgObj != null ? msgObj.toString() : "";
                                        
                                        boolean isError = severity.contains("ERROR") || severity.contains("ERR") || message.toLowerCase().contains("error") || message.toLowerCase().contains("exception") || message.toLowerCase().contains("fail");
                                        boolean isWarn = severity.contains("WARN") || message.toLowerCase().contains("warn") || message.toLowerCase().contains("warning");

                                        if (isError) {
                                            errorCount++;
                                            String service = log.get("service_name") != null ? log.get("service_name").toString() : "unknown";
                                            String brief = cleanLogMessage(message);
                                            String problem = String.format("- **[ERROR] %s**: %s", service, brief);
                                            if (!problemSummaries.contains(problem) && problemSummaries.size() < 3) {
                                                problemSummaries.add(problem);
                                            }
                                        } else if (isWarn) {
                                            warnCount++;
                                            String service = log.get("service_name") != null ? log.get("service_name").toString() : "unknown";
                                            String brief = cleanLogMessage(message);
                                            String problem = String.format("- **[WARN] %s**: %s", service, brief);
                                            if (!problemSummaries.contains(problem) && problemSummaries.size() < 3) {
                                                problemSummaries.add(problem);
                                            }
                                        }
                                    }

                                    if (errorCount > 0 || warnCount > 0) {
                                        for (String problem : problemSummaries) {
                                            sb.append(problem).append("\n");
                                        }
                                        sb.append(String.format("*(Recent logs analyzed: %d errors and %d warnings detected)*\n", errorCount, warnCount));
                                    } else {
                                        sb.append("- ✅ No significant errors or warnings detected in recent logs.\n");
                                    }
                                } else {
                                    sb.append("- No recent logs found to analyze.\n");
                                }
                            }
                        } catch (Exception e) {
                            sb.append("- Log search currently unavailable.\n");
                        }

                        // Merge anomalies into INFRA_TOPOLOGY if they exist
                        try {
                            List<com.monetique.eye.dto.AnomalyResponse> anomalies = anomalyService.getRecentAnomalies(env.getId());
                            if (anomalies != null && !anomalies.isEmpty()) {
                                sb.append("\n### 🔍 Recent Anomalies in this Environment\n");
                                for (var anomaly : anomalies) {
                                    sb.append(String.format("- **[%s] %s** (Type: %s, at %s)\n",
                                            anomaly.getSeverity(), anomaly.getDescription(), anomaly.getType(), anomaly.getTimestamp()));
                                }
                            }
                        } catch (Exception e) {
                            // ignore
                        }
                    } else {
                        sb.append(String.format("- Environment '%s' not found.\n", targetEnv));
                    }
                } else {
                    List<Environment> envs = environmentRepository.findAll();
                    sb.append(String.format("- Total active environments: %d\n", envs.size()));
                    for (Environment e : envs) {
                        long nodeCount = managedNodeRepository.countByEnvironment(e);
                        long appCount = applicationRepository.findByEnvironmentId(e.getId()).size();
                        sb.append(String.format("  * Env %s: %d nodes, %d applications\n", e.getName(), nodeCount, appCount));
                    }
                }
                break;
                
            case USER_AUDIT:
                sb.append("### 🔑 Audit & User Management\n");
                List<ActivityLog> activityLogs;
                if (targetEnv != null) {
                    activityLogs = activityLogRepository.findAll().stream()
                            .filter(l -> l.getEnv() != null && l.getEnv().equalsIgnoreCase(targetEnv))
                            .sorted((l1, l2) -> l2.getTimestamp().compareTo(l1.getTimestamp()))
                            .limit(5)
                            .toList();
                } else {
                    activityLogs = activityLogRepository.findTop10ByOrderByTimestampDesc();
                }
                
                if (!activityLogs.isEmpty()) {
                    sb.append("  - Recent Activity Logs:\n");
                    for (ActivityLog l : activityLogs) {
                        sb.append(String.format("    * [%s] %s - %s (Env: %s) by %s\n",
                                l.getTimestamp(), l.getType(), l.getTitle(), l.getEnv(),
                                l.getExecutedBy() != null ? l.getExecutedBy().getUsername() : "system"));
                    }
                } else {
                    sb.append("  - No recent activity logs found.\n");
                }
                
                List<User> users = userRepository.findAll();
                if (!users.isEmpty()) {
                    sb.append("  - Registered Users:\n");
                    for (User u : users) {
                        sb.append(String.format("    * Username: %s, Role: %s\n", u.getUsername(), u.getRole()));
                    }
                }
                break;
 
            default:
                if (targetEnv != null) {
                    return gatherTargetedContext(Intent.INFRA_TOPOLOGY, query, targetEnv, targetApp, externalCallsCount);
                }
                if (targetApp != null) {
                    return gatherTargetedContext(Intent.SECURITY_QUERY, query, targetEnv, targetApp, externalCallsCount);
                }
                // Fallback to basic cluster health for general queries
                sb.append("### 🏥 Cluster Health\n");
                sb.append(environmentRepository.count() + " environments active.\n");
                break;
        }

        return sb.toString();
    }

    private String cleanLogMessage(String message) {
        if (message == null || message.isBlank()) return "Unknown message";
        String msg = message.trim();
        // Check if message is a JSON string
        if (msg.startsWith("{") && msg.endsWith("}")) {
            try {
                // Look for the "message":"..." key value
                java.util.regex.Pattern p = java.util.regex.Pattern.compile("\"message\"\\s*:\\s*\"([^\"]+)\"");
                java.util.regex.Matcher m = p.matcher(msg);
                if (m.find()) {
                    String extracted = m.group(1);
                    extracted = extracted.replace("\\\"", "\"").replace("\\\\", "\\");
                    return extracted;
                }
            } catch (Exception e) {
                // Fallback to substring
            }
        }
        
        // Remove common spring timestamp/thread formatting if it's too long
        if (msg.contains(" : ")) {
            msg = msg.substring(msg.indexOf(" : ") + 3);
        }
        
        if (msg.length() > 150) {
            return msg.substring(0, 147) + "...";
        }
        return msg;
    }
}

