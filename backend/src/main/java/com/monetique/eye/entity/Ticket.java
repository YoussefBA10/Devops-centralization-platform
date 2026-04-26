package com.monetique.eye.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.monetique.eye.entity.enums.TicketStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "tickets")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Ticket {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "environment_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Environment environment;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "application_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Application application;

    private String title;
    
    @Column(columnDefinition = "TEXT")
    private String description;

    private String priority; // CRITICAL, HIGH, MEDIUM, LOW
    
    private String node;

    @Enumerated(EnumType.STRING)
    private TicketStatus status;

    @ManyToOne
    @JsonIgnore
    private User createdBy;

    @ManyToOne
    @JsonIgnore
    private User assignedTo;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
