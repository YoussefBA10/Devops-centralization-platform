package com.monetique.eye.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/test")
@Slf4j
public class ObservabilityTestController {

    @GetMapping("/error")
    public ResponseEntity<?> triggerError(@RequestParam(defaultValue = "500") int code) {
        if (code >= 400 && code < 600) {
            log.error("[APPLICATION] Simulated generic error for code {}", code);
            return ResponseEntity.status(code).body(Map.of(
                "status", "error",
                "message", "Simulated generic error",
                "code", code
            ));
        }
        return ResponseEntity.ok(Map.of("status", "success", "message", "Normal response"));
    }

    @GetMapping("/db-error")
    public ResponseEntity<?> triggerDbError() {
        log.error("[DATABASE] SQL Error: 1064, SQLState: 42000 (Simulated)");
        return ResponseEntity.status(500).body(Map.of(
            "status", "error",
            "type", "DATABASE",
            "message", "SQL Error: 1064, SQLState: 42000 (Simulated)"
        ));
    }

    @GetMapping("/io-error")
    public ResponseEntity<?> triggerIoError() {
        log.error("[IO] Connection reset by peer (Simulated)");
        return ResponseEntity.status(500).body(Map.of(
            "status", "error",
            "type", "IO",
            "message", "Connection reset by peer (Simulated)"
        ));
    }

    @GetMapping("/timeout")
    public ResponseEntity<?> triggerTimeout() {
        log.error("[NETWORK] Gateway Timeout (Simulated)");
        return ResponseEntity.status(504).body(Map.of(
            "status", "error",
            "type", "NETWORK",
            "message", "Gateway Timeout (Simulated)"
        ));
    }

    @GetMapping("/leak")
    public ResponseEntity<?> simulateLeak() {
        // Just a descriptive endpoint for future use
        return ResponseEntity.ok(Map.of("message", "Leak simulation endpoint ready"));
    }
}
