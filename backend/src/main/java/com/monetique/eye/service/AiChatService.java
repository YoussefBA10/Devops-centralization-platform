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
                        sb.append(String.format("- [%s] %s: %s\n", log.get("severity"), log.get("service_name"), log.get("message")));
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
                sb.append("- SecurityService endpoints pending full integration. Note: Acknowledge that you are searching for security metrics.\n");
                break;
                
            case DEPLOYMENT_STATUS:
                sb.append("[Deployments]\n");
                sb.append("- Deployment context fetcher pending integration.\n");
                break;
                
            case INFRA_TOPOLOGY:
                sb.append("[Topology]\n");
                sb.append("- Topology mapping pending integration.\n");
                break;
                
            case USER_AUDIT:
                sb.append("[Audit Logs]\n");
                sb.append("- RBAC/Audit mapping pending integration.\n");
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

