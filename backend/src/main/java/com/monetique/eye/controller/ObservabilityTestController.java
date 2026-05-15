package com.monetique.eye.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/test")
public class ObservabilityTestController {

    @GetMapping("/error")
    public ResponseEntity<?> triggerError(@RequestParam(defaultValue = "500") int code) {
        if (code >= 400 && code < 600) {
            return ResponseEntity.status(code).body(Map.of(
                "status", "error",
                "message", "Simulated error for observability testing",
                "code", code
            ));
        }
        return ResponseEntity.ok(Map.of("status", "success", "message", "Normal response"));
    }

    @GetMapping("/leak")
    public ResponseEntity<?> simulateLeak() {
        // Just a descriptive endpoint for future use
        return ResponseEntity.ok(Map.of("message", "Leak simulation endpoint ready"));
    }
}
