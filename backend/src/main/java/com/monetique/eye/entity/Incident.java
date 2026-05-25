package com.monetique.eye.entity;

import com.monetique.eye.entity.enums.IncidentSeverity;
import com.monetique.eye.entity.enums.IncidentStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "incidents")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Incident {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Application application;

    private String title;

    @Column(columnDefinition = "TEXT")
    private String aiSummary;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Ticket linkedTicket;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private IncidentSeverity severity = IncidentSeverity.P3;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private IncidentStatus status = IncidentStatus.OPEN;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private User owner;

    private LocalDateTime createdAt;
    
    private LocalDateTime resolvedAt;

    @Column(columnDefinition = "TEXT")
    private String resolutionNotes;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
