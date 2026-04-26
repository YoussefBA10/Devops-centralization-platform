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
import java.util.stream.Collectors;

@Service
public class AiChatService {

    private final GroqService groqService;
    private final EnvironmentRepository environmentRepository;
    private final ApplicationRepository applicationRepository;
    private final TicketRepository ticketRepository;
    private final DeploymentLogRepository deploymentLogRepository;
    private final AnomalyService anomalyService;
    private final PrometheusClient prometheusClient;
    private final ElasticsearchLogService esLogService;
    private final ConversationRepository conversationRepository;
    private final ObjectMapper objectMapper;

    public AiChatService(GroqService groqService,
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

        if (conversation != null && conversation.getMessagesJson() != null) {
            try {
                history = objectMapper.readValue(conversation.getMessagesJson(), new TypeReference<List<Map<String, String>>>() {});
            } catch (Exception e) {
                history = new ArrayList<>();
            }
        }

        // 1. Gather Context
        String context = gatherInfrastructureContext();

        // 2. Build History String for Prompt
        StringBuilder historySb = new StringBuilder();
        if (!history.isEmpty()) {
            historySb.append("\nPREVIOUS CONVERSATION HISTORY:\n");
            for (Map<String, String> msg : history.stream().skip(Math.max(0, history.size() - 6)).collect(Collectors.toList())) {
                historySb.append(String.format("%s: %s\n", msg.get("role").toUpperCase(), msg.get("content")));
            }
        }

        // 3. Build Prompt
        String prompt = String.format("""
                You are 'Monetique Eye AI', an advanced infrastructure assistant.
                
                USER CONTEXT (REAL-TIME METRICS & LOGS):
                %s
                %s
                
                USER QUERY:
                %s
                
                INSTRUCTIONS:
                - Use the provided REAL-TIME METRICS and LOGS to answer questions specifically.
                - Use the PREVIOUS CONVERSATION HISTORY to maintain context of the current discussion.
                - If the user asks for metrics of an app, look into the METRICS section.
                - If the user asks about recent errors or logs, look into the RECENT LOGS section.
                - Keep responses professional, concise, and enterprise-level.
                - Use markdown for lists or emphasizing key metrics.
                - If there are critical failures, high CPU usage, or open tickets, prioritize mentioning them.
                """, context, historySb.toString(), query);

        // 4. Call Groq
        String response = groqService.generateSummary(prompt);

        // 5. Update History
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

        return response;
    }

    private String gatherInfrastructureContext() {
        StringBuilder sb = new StringBuilder();

        // Environments, Apps & Metrics
        List<Environment> environments = environmentRepository.findAll();
        sb.append("INFRASTRUCTURE STATUS & METRICS:\n");
        for (Environment env : environments) {
            String envLabel = env.getPrometheusLabel() != null ? env.getPrometheusLabel() : env.getName().toLowerCase();
            Double cpu = prometheusClient.getCpuUsage(envLabel);
            Double ram = prometheusClient.getMemoryUsagePercent(envLabel);
            
            sb.append(String.format("- Environment: %s (CPU: %.1f%%, RAM: %.1f%%)\n", env.getName(), cpu, ram));
            
            List<Application> apps = applicationRepository.findByEnvironmentId(env.getId());
            for (Application app : apps) {
                sb.append(String.format("  * App: %s, Status: %s, Port: %d\n", 
                    app.getName(), app.getStatus(), app.getPort()));
            }
        }

        // Recent Logs
        sb.append("\nRECENT LOGS (Last 10 entries per environment):\n");
        for (Environment env : environments) {
            List<Map<String, Object>> logs = esLogService.getRecentLogs(env.getName().toLowerCase(), 10);
            if (!logs.isEmpty()) {
                sb.append(String.format("- Env %s logs:\n", env.getName()));
                for (Map<String, Object> log : logs) {
                    sb.append(String.format("  [%s] %s: %s\n", 
                        log.get("severity"), log.get("service_name"), log.get("message")));
                }
            }
        }

        // Open Tickets
        List<Ticket> openTickets = ticketRepository.findAll().stream()
                .filter(t -> t.getStatus() == TicketStatus.OPEN)
                .limit(5)
                .collect(Collectors.toList());
        if (!openTickets.isEmpty()) {
            sb.append("\nRECENT OPEN TICKETS:\n");
            for (Ticket t : openTickets) {
                sb.append(String.format("- [%s] %s: %s\n", t.getPriority(), t.getTitle(), t.getDescription()));
            }
        }

        // Recent Anomalies
        sb.append("\nRECENT ANOMALIES:\n");
        for (Environment env : environments) {
            var anomalies = anomalyService.getRecentAnomalies(env.getId());
            if (!anomalies.isEmpty()) {
                sb.append(String.format("- Env %s: %d anomalies detected recently.\n", env.getName(), anomalies.size()));
                anomalies.stream().limit(3).forEach(a -> 
                    sb.append(String.format("  * %s on %s: %s\n", a.getSeverity(), a.getNode(), a.getDescription())));
            }
        }

        return sb.toString();
    }
}
