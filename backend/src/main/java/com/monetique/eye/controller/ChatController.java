package com.monetique.eye.controller;

import com.monetique.eye.service.GroqService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final GroqService groqService;

    public ChatController(GroqService groqService) {
        this.groqService = groqService;
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> chat(@RequestBody Map<String, Object> request) {
        String query = (String) request.get("query");
        if (query == null || query.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        // We use the same GroqService utilized for digests but exposed for interactive chat
        String response = groqService.generateSummary(query);
        
        return ResponseEntity.ok(Map.of("response", response));
    }
}
