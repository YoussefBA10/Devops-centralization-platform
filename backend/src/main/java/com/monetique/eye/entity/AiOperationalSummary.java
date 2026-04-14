package com.monetique.eye.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "ai_operational_summaries")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiOperationalSummary {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Application application;

    @Column(columnDefinition = "TEXT")
    private String summaryText;

    private String businessRisk; // LOW, MEDIUM, HIGH, CRITICAL

    private LocalDateTime generatedAt;

    @PrePersist
    protected void onGenerate() {
        generatedAt = LocalDateTime.now();
    }
}
