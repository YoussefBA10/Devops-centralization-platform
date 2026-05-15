package com.monetique.eye.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import java.io.IOException;

/**
 * Standard filter to correlate logs with the incoming request URI.
 * This ensures that every log message generated during a request
 * automatically has the URI context, which our dashboard uses for grouping.
 */
@Component
public class LogCorrelationFilter implements Filter {
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) 
            throws IOException, ServletException {
        if (request instanceof HttpServletRequest httpRequest) {
            String uri = httpRequest.getRequestURI();
            // This 'uri' key matches what LogAnalyticsService looks for in LogEventDTO.uri
            MDC.put("uri", uri);
        }
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }
}
