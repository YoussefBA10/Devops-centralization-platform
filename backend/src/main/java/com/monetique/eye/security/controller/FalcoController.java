package com.monetique.eye.security.controller;

import com.monetique.eye.security.dto.FalcoSummaryDto;
import com.monetique.eye.security.entity.FalcoEvent;
import com.monetique.eye.security.service.FalcoEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/security/falco")
@RequiredArgsConstructor
public class FalcoController {

    private final FalcoEventService falcoEventService;

    @Value("${monetique.security.api-key:default-dev-key}")
    private String expectedApiKey;

    @PostMapping("/ingest")
    public ResponseEntity<?> ingestFalcoEvent(
            @RequestHeader(value = "X-API-Key", required = false) String apiKey,
            @RequestHeader(value = "User-Agent", required = false) String userAgent,
            @RequestBody String rawJsonBody) {

        boolean isAuthorized = expectedApiKey.equals(apiKey) || "falco/monetique-eye".equals(userAgent);
        
        if (!isAuthorized) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid API Key or unauthorized source");
        }

        try {
            FalcoEvent event = falcoEventService.ingestEvent(rawJsonBody);
            return ResponseEntity.ok(event);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error processing Falco event");
        }
    }

    @GetMapping("/events")
    public ResponseEntity<Page<FalcoEvent>> getEvents(Pageable pageable) {
        return ResponseEntity.ok(falcoEventService.getEvents(pageable));
    }

    @GetMapping("/summary")
    public ResponseEntity<FalcoSummaryDto> getSummary() {
        return ResponseEntity.ok(falcoEventService.getSummary());
    }
}
