package com.monetique.eye.controller;

import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.Environment;
import com.monetique.eye.entity.Ticket;
import com.monetique.eye.entity.enums.TicketStatus;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.repository.TicketRepository;
import com.monetique.eye.service.SecurityService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tickets")
public class TicketController {

    private final TicketRepository ticketRepository;
    private final SecurityService securityService;
    private final EnvironmentRepository environmentRepository;
    private final ApplicationRepository applicationRepository;

    public TicketController(TicketRepository ticketRepository, SecurityService securityService,
                            EnvironmentRepository environmentRepository, ApplicationRepository applicationRepository) {
        this.ticketRepository = ticketRepository;
        this.securityService = securityService;
        this.environmentRepository = environmentRepository;
        this.applicationRepository = applicationRepository;
    }

    @GetMapping
    public List<Ticket> getAll(@RequestParam(required = false) Long environmentId) {
        if (environmentId != null) {
            return ticketRepository.findByEnvironmentId(environmentId);
        }
        return ticketRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        Ticket ticket = new Ticket();
        ticket.setTitle((String) body.get("title"));
        ticket.setDescription((String) body.get("description"));
        ticket.setStatus(TicketStatus.OPEN);

        Long envId = body.get("environmentId") != null
            ? Long.valueOf(body.get("environmentId").toString()) : null;
        Long appId = body.get("applicationId") != null
            ? Long.valueOf(body.get("applicationId").toString()) : null;

        if (envId == null) return ResponseEntity.badRequest().body("environmentId required");
        Environment env = environmentRepository.findById(envId).orElse(null);
        if (env == null) return ResponseEntity.badRequest().body("Environment not found");
        ticket.setEnvironment(env);

        if (appId != null) {
            applicationRepository.findById(appId).ifPresent(ticket::setApplication);
        }

        return ResponseEntity.ok(ticketRepository.save(ticket));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or @securityService.canAccessEnvironment(#ticket.environment.id)")
    public ResponseEntity<Ticket> update(@PathVariable Long id, @RequestBody Ticket ticket) {
        if (!ticketRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        ticket.setId(id);
        return ResponseEntity.ok(ticketRepository.save(ticket));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<Ticket> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> request) {
        Ticket ticket = ticketRepository.findById(id).orElse(null);
        if (ticket == null) {
            return ResponseEntity.notFound().build();
        }
        
        // ADMIN always has access; others must be linked to the environment
        if (!securityService.canAccessEnvironment(ticket.getEnvironment().getId())) {
            return ResponseEntity.status(403).build();
        }

        try {
            ticket.setStatus(TicketStatus.valueOf(request.get("status")));
            return ResponseEntity.ok(ticketRepository.save(ticket));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
