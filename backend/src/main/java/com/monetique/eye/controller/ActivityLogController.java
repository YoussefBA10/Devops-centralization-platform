package com.monetique.eye.controller;

import com.monetique.eye.entity.ActivityLog;
import com.monetique.eye.repository.ActivityLogRepository;
import jakarta.persistence.criteria.Predicate;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.PrintWriter;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/audit-logs")
@RequiredArgsConstructor
public class ActivityLogController {

    private final ActivityLogRepository activityLogRepository;

    @GetMapping
    public Page<ActivityLog> getLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to
    ) {
        Specification<ActivityLog> spec = buildSpecification(search, type, from, to);
        return activityLogRepository.findAll(spec, PageRequest.of(page, size, Sort.by("timestamp").descending()));
    }

    @GetMapping("/export")
    public void exportLogs(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            HttpServletResponse response
    ) throws IOException {
        Specification<ActivityLog> spec = buildSpecification(search, type, from, to);
        List<ActivityLog> logs = activityLogRepository.findAll(spec, Sort.by("timestamp").descending());

        response.setContentType("text/csv;charset=UTF-8");
        response.setHeader("Content-Disposition", "attachment; filename=audit_logs.csv");

        PrintWriter writer = response.getWriter();
        // Add UTF-8 BOM for Excel
        writer.write('\uFEFF');
        // Tell Excel what the separator is
        writer.println("sep=,");
        writer.println("Timestamp,Category,Activity,Environment,User");

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(java.time.ZoneId.of("UTC"));

        for (ActivityLog log : logs) {
            String user = log.getExecutedBy() != null ? log.getExecutedBy().getUsername() : "System";
            writer.printf("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"%n",
                    formatter.format(log.getTimestamp()),
                    log.getType(),
                    log.getTitle().replace("\"", "\"\""),
                    log.getEnv().replace("\"", "\"\""),
                    user.replace("\"", "\"\"")
            );
        }
        writer.flush();
    }

    private Specification<ActivityLog> buildSpecification(String search, String type, String from, String to) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (search != null && !search.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("title")), "%" + search.toLowerCase() + "%"));
            }

            if (type != null && !type.isBlank()) {
                predicates.add(cb.equal(root.get("type"), type));
            }

            if (from != null && !from.isBlank()) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("timestamp"), LocalDateTime.parse(from).toInstant(java.time.ZoneOffset.UTC)));
            }

            if (to != null && !to.isBlank()) {
                predicates.add(cb.lessThanOrEqualTo(root.get("timestamp"), LocalDateTime.parse(to).toInstant(java.time.ZoneOffset.UTC)));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
