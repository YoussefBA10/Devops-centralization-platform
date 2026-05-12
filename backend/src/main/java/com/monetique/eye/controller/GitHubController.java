package com.monetique.eye.controller;

import com.monetique.eye.entity.Application;
import com.monetique.eye.repository.ApplicationRepository;
import com.monetique.eye.service.GitHubService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/github")
public class GitHubController {
    private static final Logger log = LoggerFactory.getLogger(GitHubController.class);

    private final GitHubService gitHubService;
    private final ApplicationRepository applicationRepository;

    public GitHubController(GitHubService gitHubService, ApplicationRepository applicationRepository) {
        this.gitHubService = gitHubService;
        this.applicationRepository = applicationRepository;
    }

    @GetMapping("/install")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getInstallUrl(@RequestParam Long appId) {
        // We use state to pass the appId through the flow
        String url = "https://github.com/apps/monetique-eye-deploy/installations/new?state=" + appId;
        return ResponseEntity.ok(Map.of("url", url));
    }

    @GetMapping("/callback")
    public ResponseEntity<?> callback(@RequestParam("installation_id") String installationId,
                                    @RequestParam("state") Long appId) {
        log.info("Received GitHub installation callback for App ID: {} (Installation ID: {})", appId, installationId);
        
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new RuntimeException("Application not found"));
        
        app.setGithubInstallationId(installationId);
        
        try {
            // Fetch repo info for this installation
            // We'll use the installation token to ask GitHub about the repos
            String token = gitHubService.getInstallationToken(installationId);
            
            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(token);
            headers.set("Accept", "application/vnd.github+json");
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            String url = "https://api.github.com/installation/repositories";
            
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                java.util.List<Map<String, Object>> repos = (java.util.List<Map<String, Object>>) response.getBody().get("repositories");
                if (repos != null && !repos.isEmpty()) {
                    // Try to find the exact match for current app repo URL
                    String targetRepoUrl = app.getRepoUrl().toLowerCase().replace(".git", "");
                    Map<String, Object> matchingRepo = repos.stream()
                        .filter(r -> {
                            String cloneUrl = ((String) r.get("clone_url")).toLowerCase().replace(".git", "");
                            return cloneUrl.equals(targetRepoUrl);
                        })
                        .findFirst()
                        .orElse(repos.get(0)); // Fallback to first if no perfect match

                    app.setGithubRepoFullName((String) matchingRepo.get("full_name"));
                    app.setGithubRepoUrl((String) matchingRepo.get("clone_url"));
                    log.info("Linked repository: {}", app.getGithubRepoFullName());
                }
            }
        } catch (Exception e) {
            log.error("Failed to fetch repository info during callback: {}", e.getMessage());
        }

        applicationRepository.save(app);

        return ResponseEntity.ok("<html><body><h2>Installation Successful!</h2><p>You can now close this window.</p><script>setTimeout(() => window.close(), 2000);</script></body></html>");
    }

    @PostMapping("/apps/{appId}/disconnect")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> disconnect(@PathVariable Long appId) {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new RuntimeException("Application not found"));
        
        app.setGithubInstallationId(null);
        app.setGithubRepoFullName(null);
        app.setGithubRepoUrl(null);
        applicationRepository.save(app);

        return ResponseEntity.ok(Map.of("message", "GitHub App disconnected successfully"));
    }

    @GetMapping("/apps/{appId}/token")
    public ResponseEntity<?> getAppToken(@PathVariable Long appId) {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new RuntimeException("Application not found"));

        if (app.getGithubInstallationId() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "GitHub App not installed for this application"));
        }

        try {
            String token = gitHubService.getInstallationToken(app.getGithubInstallationId());
            return ResponseEntity.ok(Map.of("token", token));
        } catch (Exception e) {
            log.error("Failed to generate token for app {}: {}", appId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("message", "Failed to generate GitHub token: " + e.getMessage()));
        }
    }
}
