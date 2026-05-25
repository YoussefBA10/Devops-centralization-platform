package com.monetique.eye.entity;

import com.monetique.eye.entity.enums.AlertGroupStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "alert_groups")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlertGroup {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 64)
    private String fingerprint;

    private String name;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private AlertGroupStatus status = AlertGroupStatus.FIRING;

    @Column(length = 10)
    private String severity;

    private LocalDateTime firstFiredAt;
    private LocalDateTime lastFiredAt;
    private LocalDateTime resolvedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id")
    private Ticket ticket;

    @PrePersist
    protected void onCreate() {
        if (firstFiredAt == null) {
            firstFiredAt = LocalDateTime.now();
        }
    }
}
