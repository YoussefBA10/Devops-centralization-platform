package com.monetique.eye.security;

import com.monetique.eye.entity.Environment;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.repository.TicketRepository;
import com.monetique.eye.service.PermissionService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;
import java.util.List;

@Aspect
@Component
@RequiredArgsConstructor
public class PermissionAspect {

    private final PermissionService permissionService;
    private final EnvironmentRepository environmentRepository;
    private final ApplicationRepository applicationRepository;
    private final TicketRepository ticketRepository;

    @Before("@annotation(requiresPermission) || @within(requiresPermission)")
    public void checkPermission(JoinPoint joinPoint, RequiresPermission requiresPermission) {
        // If both class and method have the annotation, AOP might trigger twice 
        // or we need to be careful. By using || we ensure it triggers if either is present.
        // We can also extract the annotation manually to handle overrides.
        
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        
        // Priority: Method annotation > Class annotation
        RequiresPermission annotation = method.getAnnotation(RequiresPermission.class);
        if (annotation == null) {
            annotation = joinPoint.getTarget().getClass().getAnnotation(RequiresPermission.class);
        }
        
        if (annotation == null) return;

        String permissionKey = annotation.value();
        String username = SecurityContextHolder.getContext().getAuthentication().getName();

        // 1. Basic Permission Check
        if (!permissionService.can(username, permissionKey)) {
            throw new AccessDeniedException(getErrorMessage(permissionKey, null));
        }

        // 2. Environment Scope Check
        if (isEnvironmentScoped(permissionKey)) {
            Long envId = findEnvironmentId(joinPoint, permissionKey);
            if (envId != null) {
                if (!permissionService.hasEnvironmentAccess(username, envId.toString())) {
                    String envName = environmentRepository.findById(envId)
                            .map(Environment::getName)
                            .orElse("ID: " + envId);
                    throw new AccessDeniedException(getErrorMessage("ENV_ACCESS_DENIED", envName));
                }
            }
        }
    }

    private boolean isEnvironmentScoped(String key) {
        return key.startsWith("MONITORING_") || key.startsWith("ENV_DEPLOYMENT_") || key.startsWith("APP_DEPLOYMENT_") || key.startsWith("INCIDENTS_");
    }

    private Long findEnvironmentId(JoinPoint joinPoint, String permissionKey) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        String[] parameterNames = signature.getParameterNames();
        Object[] args = joinPoint.getArgs();

        if (parameterNames != null) {
            for (int i = 0; i < parameterNames.length; i++) {
                if ("environmentId".equals(parameterNames[i])) {
                    if (args[i] instanceof Long) return (Long) args[i];
                    if (args[i] instanceof String) {
                        try { return Long.parseLong((String) args[i]); } catch (NumberFormatException ignored) {}
                    }
                }
                
                // If parameter is just 'id', we need to check if it's an Environment ID or an Entity ID (App/Ticket)
                if ("id".equals(parameterNames[i])) {
                    Long id = null;
                    if (args[i] instanceof Long) id = (Long) args[i];
                    else if (args[i] instanceof String) {
                        try { id = Long.parseLong((String) args[i]); } catch (NumberFormatException ignored) {}
                    }
                    
                    if (id != null) {
                        // Check if this permission pertains to Applications
                        if (permissionKey.startsWith("APP_DEPLOYMENT_")) {
                            return applicationRepository.findById(id)
                                    .map(app -> app.getEnvironment().getId())
                                    .orElse(null);
                        }
                        // Check if this permission pertains to Incidents/Tickets
                        if (permissionKey.startsWith("INCIDENTS_")) {
                            return ticketRepository.findById(id)
                                    .map(ticket -> ticket.getEnvironment().getId())
                                    .orElse(null);
                        }
                        // Default assumption: 'id' is Environment ID for ENV_DEPLOYMENT or MONITORING
                        return id;
                    }
                }
            }
        }

        // Fallback to request parameters
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes != null) {
            HttpServletRequest request = attributes.getRequest();
            String envIdStr = request.getParameter("environmentId");
            if (envIdStr != null) {
                try { return Long.parseLong(envIdStr); } catch (NumberFormatException ignored) {}
            }
        }

        return null;
    }

    private String getErrorMessage(String key, String context) {
        return switch (key) {
            case "ENVIRONMENT_ACCESS" -> "You don't have access to the environments feature.";
            case "MONITORING_OBSERVABILITY" -> "You don't have permission to view observability dashboards.";
            case "MONITORING_LOGS" -> "You don't have permission to view or search logs.";
            case "MONITORING_INFRA_GRAPH" -> "You don't have permission to view the infrastructure graph.";
            case "ENV_DEPLOYMENT_VIEW" -> "You don't have permission to view environments.";
            case "ENV_DEPLOYMENT_CREATE" -> "You don't have permission to create environments.";
            case "ENV_DEPLOYMENT_EDIT" -> "You don't have permission to modify environments.";
            case "ENV_DEPLOYMENT_DELETE" -> "You don't have permission to delete environments.";
            case "APP_DEPLOYMENT_VIEW" -> "You don't have permission to view applications.";
            case "APP_DEPLOYMENT_CREATE" -> "You don't have permission to start new deployments.";
            case "APP_DEPLOYMENT_EDIT" -> "You don't have permission to restart or modify applications.";
            case "APP_DEPLOYMENT_DELETE" -> "You don't have permission to delete applications.";
            case "INCIDENTS_VIEW" -> "You don't have permission to view incident tickets.";
            case "INCIDENTS_CREATE" -> "You don't have permission to create incident tickets.";
            case "INCIDENTS_EDIT" -> "You don't have permission to modify incident tickets.";
            case "INCIDENTS_DELETE" -> "You don't have permission to delete incident tickets.";
            case "CHATBOT_ACCESS" -> "You don't have access to the Monetique Eye AI assistant.";
            case "ENV_ACCESS_DENIED" -> "Access denied for environment: " + context;
            default -> "Access denied. Insufficient permissions.";
        };
    }
}
