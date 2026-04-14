package com.monetique.eye.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "log_aggregation_windows")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LogAggregationWindow {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Application application;

    private String node;
    private int errorCount;
    private double stabilityScore;
    private LocalDateTime windowStart;
    private LocalDateTime windowEnd;
}
