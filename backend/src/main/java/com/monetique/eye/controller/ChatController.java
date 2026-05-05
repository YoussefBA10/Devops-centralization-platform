package com.monetique.eye.controller;

import com.monetique.eye.entity.Conversation;
import com.monetique.eye.entity.User;
import com.monetique.eye.service.AiChatService;
import com.monetique.eye.service.SecurityService;
import com.monetique.eye.repository.ConversationRepository;
import com.monetique.eye.security.RequiresPermission;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/chat")
@RequiresPermission("CHATBOT_ACCESS")
public class ChatController {

    private final AiChatService aiChatService;
    private final SecurityService securityService;
    private final ConversationRepository conversationRepository;

    public ChatController(AiChatService aiChatService, 
                          SecurityService securityService,
                          ConversationRepository conversationRepository) {
        this.aiChatService = aiChatService;
        this.securityService = securityService;
        this.conversationRepository = conversationRepository;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> chat(@RequestBody Map<String, Object> request) {
        String query = (String) request.get("query");
        Long conversationId = request.get("conversationId") != null ? Long.valueOf(request.get("conversationId").toString()) : null;
        
        if (query == null || query.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        User user = securityService.getCurrentUser();
        String response = aiChatService.processQueryWithConversation(conversationId, query, user);
        
        // Find the conversation again to return its ID (especially if it was just created)
        Conversation conv = null;
        if (conversationId != null) {
            conv = conversationRepository.findById(conversationId).orElse(null);
        } else if (user != null) {
            conv = conversationRepository.findByUserOrderByStartedAtDesc(user).stream().findFirst().orElse(null);
        }

        return ResponseEntity.ok(Map.of(
            "response", response,
            "conversationId", conv != null ? conv.getId() : -1
        ));
    }

    @GetMapping("/history")
    public List<Conversation> getHistory() {
        User user = securityService.getCurrentUser();
        if (user == null) return List.of();
        return conversationRepository.findByUserOrderByStartedAtDesc(user);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Conversation> getConversation(@PathVariable Long id) {
        return conversationRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteConversation(@PathVariable Long id) {
        conversationRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }
}
