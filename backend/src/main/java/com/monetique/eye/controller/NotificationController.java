package com.monetique.eye.controller;

import com.monetique.eye.entity.Notification;
import com.monetique.eye.service.NotificationService;
import com.monetique.eye.service.SecurityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;
    private final SecurityService securityService;

    @GetMapping
    public List<Notification> getNotifications() {
        String userId = securityService.getCurrentUser().getUsername();
        return notificationService.getNotificationsForUser(userId);
    }

    @GetMapping("/unread-count")
    public Map<String, Long> getUnreadCount() {
        String userId = securityService.getCurrentUser().getUsername();
        return Map.of("count", notificationService.getUnreadCount(userId));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable Long id) {
        notificationService.markAsRead(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllAsRead() {
        String userId = securityService.getCurrentUser().getUsername();
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok().build();
    }
}
