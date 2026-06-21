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
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
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
                // Execute actual action (mocked for now, needs actual service call)
                String result = "Action " + pendingAction.getActionType() + " executed successfully for " + 
                                pendingAction.getTargetApp() + " on " + pendingAction.getTargetEnv() + ".";
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
        Intent intent = intentClassifier.classifyIntent(query);
        
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
        
        // Handle Actions
        if (intent == Intent.ACTION_REQUEST) {
            String targetApp = intentClassifier.extractApplication(query);
            String targetEnv = intentClassifier.extractEnvironment(query);
            
            if (targetApp == null || targetEnv == null) {
                String fallback = "To perform an action, I need both the target Application and Environment. Could you clarify?";
                updateHistory(conversation, history, query, fallback);
                return fallback;
            }
            
            pendingActions.put(activeConversationId, new PendingAction("RESTART", targetApp, targetEnv));
            String response = "You have requested to perform an action on the **" + targetApp + "** application in the **" + targetEnv + "** environment. Please reply with 'Yes' to confirm execution.";
            updateHistory(conversation, history, query, response);
            return response;
        }

        // 3. Gather Targeted Context based on Intent
        String context = gatherTargetedContext(intent, query);

        // 4. Build History String for Prompt
        StringBuilder historySb = new StringBuilder();
        if (!history.isEmpty()) {
            historySb.append("\nPREVIOUS CONVERSATION HISTORY:\n");
            for (Map<String, String> msg : history.stream().skip(Math.max(0, history.size() - 6)).collect(Collectors.toList())) {
                historySb.append(String.format("%s: %s\n", msg.get("role").toUpperCase(), msg.get("content")));
            }
        }

        // 5. Build Prompt
        String prompt = String.format("""
                You are 'Monetique Eye AI', an advanced infrastructure assistant.
                
                USER INTENT: %s
                
                RELEVANT CONTEXT:
                %s
                %s
                
                USER QUERY:
                %s
                
                INSTRUCTIONS:
                - Use the provided RELEVANT CONTEXT to answer the query specifically.
                - Keep responses professional, concise, and enterprise-level.
                - Use markdown for lists or emphasizing key metrics.
                - If data is missing from the context, explicitly state that you don't have enough data rather than hallucinating.
                """, intent.name(), context, historySb.toString(), query);

        // 6. Call Groq
        String response = groqService.generateSummary(prompt);

        // Fallback: If Groq failed or was rate limited, we can still present the gathered context
        if (response != null && (response.contains("rate limit reached") || response.contains("unavailable") || response.contains("Error:"))) {
            if (context != null && !context.isBlank()) {
                response = String.format("""
                        *Note: The AI summarization service is currently busy or rate-limited. To ensure you aren't blocked, here is the raw infrastructure data retrieved for your request:*
                        
                        %s
                        
                        *Please try again in a few seconds for an AI-generated summary.*
                        """, context);
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

    private String gatherTargetedContext(Intent intent, String query) {
        StringBuilder sb = new StringBuilder();
        String targetEnv = intentClassifier.extractEnvironment(query);
        String targetApp = intentClassifier.extractApplication(query);

        // Only fetch what is needed based on Intent
        switch (intent) {
            case METRIC_QUERY:
                sb.append("[Metrics]\n");
                if (targetEnv != null) {
                    Environment env = environmentRepository.findAll().stream().filter(e -> e.getName().equalsIgnoreCase(targetEnv)).findFirst().orElse(null);
                    if (env != null) {
                        String envLabel = env.getPrometheusLabel() != null ? env.getPrometheusLabel() : env.getName().toLowerCase();
                        Double cpu = prometheusClient.getCpuUsage(envLabel);
                        Double ram = prometheusClient.getMemoryUsagePercent(envLabel);
                        sb.append(String.format("- Env %s CPU: %.1f%%, RAM: %.1f%%\n", env.getName(), cpu, ram));
                    }
                } else {
                    sb.append("Please specify an environment to get accurate metrics.\n");
                }
                break;
                
            case LOG_SEARCH:
                sb.append("[Recent Logs]\n");
                if (targetEnv != null) {
                    List<Map<String, Object>> logs = esLogService.getRecentLogs(targetEnv.toLowerCase(), 10);
                    for (Map<String, Object> log : logs) {
                        Object msg = log.get("raw_message") != null ? log.get("raw_message") : log.get("message");
                        sb.append(String.format("- [%s] %s: %s\n", log.get("severity"), log.get("service_name"), msg));
                    }
                }
                break;
                
            case INCIDENT_SUMMARY:
                sb.append("[Incidents & Alerts]\n");
                List<Ticket> openTickets = ticketRepository.findAll().stream()
                        .filter(t -> t.getStatus() == TicketStatus.OPEN)
                        .limit(5)
                        .collect(Collectors.toList());
                for (Ticket t : openTickets) {
                    sb.append(String.format("- [%s] %s: %s\n", t.getPriority(), t.getTitle(), t.getDescription()));
                }
                break;
                
            case SECURITY_QUERY:
                sb.append("[Security Posture]\n");
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
                sb.append("[Deployments]\n");
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
                sb.append("[Topology]\n");
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
                        
                        sb.append("\n[Metrics]\n");
                        try {
                            String envLabel = env.getPrometheusLabel() != null ? env.getPrometheusLabel() : env.getName().toLowerCase();
                            Double cpu = prometheusClient.getCpuUsage(envLabel);
                            Double ram = prometheusClient.getMemoryUsagePercent(envLabel);
                            sb.append(String.format("- CPU Usage: %.1f%%, RAM Usage: %.1f%%\n", cpu, ram));
                        } catch (Exception e) {
                            sb.append("- Metrics currently unavailable.\n");
                        }

                        sb.append("\n[Recent Logs]\n");
                        try {
                            java.util.List<java.util.Map<String, Object>> envLogs = esLogService.getRecentLogs(env.getName().toLowerCase(), 5);
                            if (envLogs != null && !envLogs.isEmpty()) {
                                for (java.util.Map<String, Object> log : envLogs) {
                                    Object msg = log.get("raw_message") != null ? log.get("raw_message") : log.get("message");
                                    sb.append(String.format("- [%s] %s: %s\n", log.get("severity"), log.get("service_name"), msg));
                                }
                            } else {
                                sb.append("- No recent logs found.\n");
                            }
                        } catch (Exception e) {
                            sb.append("- Log search currently unavailable.\n");
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
                sb.append("[Audit Logs]\n");
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
                // Fallback to basic cluster health for general queries
                sb.append("[Cluster Health]\n");
                sb.append(environmentRepository.count() + " environments active.\n");
                break;
        }

        return sb.toString();
    }
}

