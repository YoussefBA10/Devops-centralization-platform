package com.monetique.eye.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "recurring_patterns")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecurringPattern {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Application application;

    @Column(nullable = false)
    private String patternHash;

    @Column(columnDefinition = "TEXT")
    private String sampleMessage;

    private int occurrences;
    private String riskLevel;
    private LocalDateTime firstSeen;
    private LocalDateTime lastSeen;
}
