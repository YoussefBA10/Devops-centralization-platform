package com.monetique.eye.controller;

import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.Environment;
import com.monetique.eye.entity.Ticket;
import com.monetique.eye.entity.enums.TicketStatus;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.repository.TicketRepository;
import com.monetique.eye.service.ActivityLogService;
import com.monetique.eye.service.SecurityService;
import com.monetique.eye.security.RequiresPermission;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tickets")
public class TicketController {

    private final TicketRepository ticketRepository;
    private final SecurityService securityService;
    private final ActivityLogService activityLogService;
    private final EnvironmentRepository environmentRepository;
    private final ApplicationRepository applicationRepository;

    public TicketController(TicketRepository ticketRepository, SecurityService securityService,
                            ActivityLogService activityLogService,
                            EnvironmentRepository environmentRepository, ApplicationRepository applicationRepository) {
        this.ticketRepository = ticketRepository;
        this.securityService = securityService;
        this.activityLogService = activityLogService;
        this.environmentRepository = environmentRepository;
        this.applicationRepository = applicationRepository;
    }

    @GetMapping
    @RequiresPermission("INCIDENTS_VIEW")
    public List<Ticket> getAll(@RequestParam(required = false) Long environmentId) {
        if (environmentId != null) {
            return ticketRepository.findByEnvironmentId(environmentId);
        }
        return ticketRepository.findAll();
    }

    @PostMapping
    @RequiresPermission("INCIDENTS_CREATE")
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        Ticket ticket = new Ticket();
        ticket.setTitle((String) body.get("title"));
        ticket.setDescription((String) body.get("description"));
        ticket.setPriority((String) body.get("priority"));
        ticket.setNode((String) body.get("node"));
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
    @RequiresPermission("INCIDENTS_EDIT")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Ticket ticket = ticketRepository.findById(id).orElse(null);
        if (ticket == null) {
            return ResponseEntity.notFound().build();
        }

        if (body.containsKey("title")) ticket.setTitle((String) body.get("title"));
        if (body.containsKey("description")) ticket.setDescription((String) body.get("description"));
        if (body.containsKey("priority")) ticket.setPriority((String) body.get("priority"));
        if (body.containsKey("node")) ticket.setNode((String) body.get("node"));
        if (body.containsKey("status")) {
            try {
                ticket.setStatus(TicketStatus.valueOf((String) body.get("status")));
            } catch (IllegalArgumentException ignored) {}
        }

        if (body.containsKey("environmentId")) {
            Long envId = Long.valueOf(body.get("environmentId").toString());
            environmentRepository.findById(envId).ifPresent(ticket::setEnvironment);
        }

        if (body.containsKey("applicationId")) {
            Object appIdObj = body.get("applicationId");
            if (appIdObj != null) {
                Long appId = Long.valueOf(appIdObj.toString());
                applicationRepository.findById(appId).ifPresent(ticket::setApplication);
            } else {
                ticket.setApplication(null);
            }
        }

        return ResponseEntity.ok(ticketRepository.save(ticket));
    }

    @PutMapping("/{id}/status")
    @RequiresPermission("INCIDENTS_EDIT")
    public ResponseEntity<Ticket> updateStatus(@PathVariable Long id, @RequestParam String status) {
        Ticket ticket = ticketRepository.findById(id).orElse(null);
        if (ticket == null) {
            return ResponseEntity.notFound().build();
        }
        
        try {
            ticket.setStatus(TicketStatus.valueOf(status));
            Ticket saved = ticketRepository.save(ticket);
            activityLogService.logActivity("Ticket Status Updated: " + status + " (" + ticket.getTitle() + ")", "incident", ticket.getEnvironment().getName());
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }
    @DeleteMapping("/{id}")
    @RequiresPermission("INCIDENTS_DELETE")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        Ticket ticket = ticketRepository.findById(id).orElse(null);
        if (ticket == null) {
            return ResponseEntity.notFound().build();
        }
        String envName = ticket.getEnvironment() != null ? ticket.getEnvironment().getName() : "Global";
        ticketRepository.delete(ticket);
        activityLogService.logActivity("Ticket Deleted: " + ticket.getTitle(), "incident", envName);
        return ResponseEntity.ok().build();
    }
}
