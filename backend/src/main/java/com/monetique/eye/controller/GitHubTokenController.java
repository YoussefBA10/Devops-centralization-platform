package com.monetique.eye.controller;

import com.monetique.eye.entity.GitHubToken;
import com.monetique.eye.repository.GitHubTokenRepository;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/github")
public class GitHubTokenController {

    private final GitHubTokenRepository gitHubTokenRepository;

    public GitHubTokenController(GitHubTokenRepository gitHubTokenRepository) {
        this.gitHubTokenRepository = gitHubTokenRepository;
    }

    @PostMapping("/token")
    public ResponseEntity<?> saveToken(@RequestBody Map<String, String> request, Authentication authentication) {
        String tokenStr = request.get("token");
        if (tokenStr == null || tokenStr.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Token is required"));
        }

        String userId = authentication.getName();

        try {
            WebClient webClient = WebClient.builder()
                    .baseUrl("https://api.github.com")
                    .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + tokenStr)
                    .defaultHeader(HttpHeaders.ACCEPT, "application/vnd.github+json")
                    .defaultHeader("X-GitHub-Api-Version", "2022-11-28")
                    .build();

            Map<String, Object> userResponse = webClient.get()
                    .uri("/user")
                    .retrieve()
                    .bodyToMono(new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {})
                    .block();

            String githubUsername = (String) userResponse.get("login");

            GitHubToken token = gitHubTokenRepository.findByUserId(userId).orElse(new GitHubToken());
            token.setUserId(userId);
            token.setAccessToken(tokenStr);
            token.setGithubUsername(githubUsername);
            if (token.getCreatedAt() == null) {
                token.setCreatedAt(LocalDateTime.now());
            }

            gitHubTokenRepository.save(token);

            return ResponseEntity.ok(Map.of(
                    "githubUsername", githubUsername,
                    "message", "GitHub token saved successfully"
            ));

        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("message", "Invalid GitHub token: " + e.getMessage()));
        }
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus(Authentication authentication) {
        String userId = authentication.getName();
        Optional<GitHubToken> tokenOpt = gitHubTokenRepository.findByUserId(userId);

        if (tokenOpt.isPresent()) {
            return ResponseEntity.ok(Map.of(
                    "connected", true,
                    "githubUsername", tokenOpt.get().getGithubUsername()
            ));
        }

        return ResponseEntity.ok(Map.of("connected", false));
    }

    @DeleteMapping("/token")
    public ResponseEntity<?> deleteToken(Authentication authentication) {
        String userId = authentication.getName();
        gitHubTokenRepository.findByUserId(userId).ifPresent(gitHubTokenRepository::delete);
        return ResponseEntity.ok(Map.of("message", "GitHub token removed successfully"));
    }
}
