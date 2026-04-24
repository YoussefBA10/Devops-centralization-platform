package com.monetique.eye.controller;

import com.monetique.eye.service.GitHubService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/deploy")
public class DeployController {

    private final GitHubService gitHubService;

    public DeployController(GitHubService gitHubService) {
        this.gitHubService = gitHubService;
    }

    @GetMapping("/repos")
    public ResponseEntity<List<Map<String, Object>>> getUserRepos(Authentication authentication) {
        try {
            List<Map<String, Object>> repos = gitHubService.getUserRepos(authentication.getName());
            return ResponseEntity.ok(repos);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(List.of(Map.of("error", e.getMessage())));
        }
    }
}
