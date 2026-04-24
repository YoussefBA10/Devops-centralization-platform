package com.monetique.eye.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "github_tokens")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GitHubToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String userId;

    @Column(nullable = false, length = 1000)
    private String accessToken;

    private String githubUsername;

    @Column(nullable = false)
    private LocalDateTime createdAt;
}
