package com.monetique.eye.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

/**
 * Filter to explicitly log request context for Logstash parsing.
 * This logs a structured line when an error occurs, ensuring the URI
 * is available for Elasticsearch aggregations even if not in application logs.
 */
@Component
@Slf4j
public class RequestLoggingFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            filterChain.doFilter(request, response);
        } finally {
            // Only log if it's an error to keep log volume manageable
            if (response.getStatus() >= 400) {
                // Format: [ACCESS] METHOD URI STATUS
                log.error("[ACCESS] {} {} {}", 
                    request.getMethod(), 
                    request.getRequestURI(), 
                    response.getStatus());
            }
        }
    }
}
