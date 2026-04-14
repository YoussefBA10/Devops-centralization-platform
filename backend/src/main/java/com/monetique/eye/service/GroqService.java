package com.monetique.eye.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import java.util.Map;
import java.util.List;

@Service
public class GroqService {

    private final WebClient webClient;
    private final String model;

    public GroqService(@Value("${groq.api-key}") String apiKey, 
                       @Value("${groq.model}") String model,
                       WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder
                .baseUrl("https://api.groq.com/openai/v1")
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .build();
        this.model = model;
    }

    public String generateSummary(String prompt) {
        Map<String, Object> requestBody = Map.of(
                "model", model,
                "messages", List.of(
                        Map.of("role", "system", "content", "You are an AI Ops expert assisting a CTO with infrastructure observability."),
                        Map.of("role", "user", "content", prompt)
                ),
                "temperature", 0.7
        );

        try {
            Map result = webClient.post()
                    .uri("/chat/completions")
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (result != null) {
                List choices = (List) result.get("choices");
                Map firstChoice = (Map) choices.get(0);
                Map message = (Map) firstChoice.get("message");
                return message.get("content").toString();
            }
        } catch (Exception e) {
            // Log Groq error
        }
        return "AI Summary unavailable at this time.";
    }
}
