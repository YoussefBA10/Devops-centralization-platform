package com.monetique.eye.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import java.util.Map;
import java.util.List;

@Service
public class GroqService {

    private static final Logger log = LoggerFactory.getLogger(GroqService.class);
    private static final int MAX_RETRIES = 3;
    private static final long INITIAL_BACKOFF_MS = 2000;

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

        for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
            } catch (WebClientResponseException.TooManyRequests e) {
                if (attempt < MAX_RETRIES) {
                    long backoff = INITIAL_BACKOFF_MS * (1L << attempt); // 2s, 4s, 8s
                    log.warn("Groq rate limited (429). Retrying in {}ms (attempt {}/{})", backoff, attempt + 1, MAX_RETRIES);
                    try {
                        Thread.sleep(backoff);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return "AI Summary unavailable: interrupted during retry.";
                    }
                } else {
                    log.error("Groq rate limit exceeded after {} retries.", MAX_RETRIES);
                    return "AI Summary temporarily unavailable — Groq rate limit reached. Please try again in a few seconds.";
                }
            } catch (Exception e) {
                log.error("Groq API error: {}", e.getMessage());
                return "AI Summary unavailable at this time. Error: " + e.getMessage();
            }
        }
        return "AI Summary unavailable at this time.";
    }
}

