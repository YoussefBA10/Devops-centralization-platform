package com.monetique.eye.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "conversations")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Conversation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Application application; // Null if general chat

    @Column(columnDefinition = "TEXT")
    private String messagesJson; // Simplified history

    private LocalDateTime startedAt;

    @PrePersist
    protected void onStart() {
        startedAt = LocalDateTime.now();
    }
}
