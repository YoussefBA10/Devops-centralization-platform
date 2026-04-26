package com.monetique.eye.util;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDeniedException(AccessDeniedException e) {
        String message = e.getMessage();
        String error = "ACCESS_DENIED";
        
        // Check if it's the admin-only case
        if (message != null && message.contains("Only administrators can perform this action")) {
            error = "FORBIDDEN";
        }

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                "error", error,
                "message", message != null ? message : "Access Denied"
        ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGeneralException(Exception e) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "error", "INTERNAL_SERVER_ERROR",
                "message", e.getMessage() != null ? e.getMessage() : "An unexpected error occurred"
        ));
    }
}
