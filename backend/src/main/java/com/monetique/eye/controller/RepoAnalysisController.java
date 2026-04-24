package com.monetique.eye.controller;

import com.monetique.eye.dto.RepoAnalysisDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

@Slf4j
@RestController
@RequestMapping("/api/repo")
public class RepoAnalysisController {
    
    @Value("${monetique.git.executable:git}")
    private String gitExecutable;

    private final com.monetique.eye.service.GitHubService gitHubService;

    public RepoAnalysisController(com.monetique.eye.service.GitHubService gitHubService) {
        this.gitHubService = gitHubService;
    }

    @PostMapping("/analyze")
    public ResponseEntity<RepoAnalysisDTO.Response> analyzeRepo(@RequestBody RepoAnalysisDTO.Request request, org.springframework.security.core.Authentication authentication) {
        Path tempDir = null;
        try {
            // Validate input
            if (request.getRepoUrl() == null || request.getRepoUrl().isBlank()) {
                return ResponseEntity.badRequest().body(RepoAnalysisDTO.Response.builder()
                        .error("Repository URL is required").build());
            }

            String branch = (request.getBranch() != null && !request.getBranch().isBlank()) ? request.getBranch() : "main";
            String repoUrl = request.getRepoUrl();

            if (!repoUrl.startsWith("http")) {
                // It's a repo full name (e.g., owner/repo), use GitHubService with PAT
                String userId = authentication.getName();
                tempDir = gitHubService.cloneRepo(userId, repoUrl, branch);
            } else {
                // Create temp directory for public repo
                tempDir = Files.createTempDirectory("repo-analysis-");
                log.info("Analyzing public repo: {} branch: {} into {}", repoUrl, branch, tempDir);

                // Shallow clone
                String gitCmd = resolveGitExecutable();
                ProcessBuilder pb = new ProcessBuilder(
                        gitCmd, "clone", "--depth", "1", "--branch", branch,
                        repoUrl, tempDir.toString()
                );
                pb.redirectErrorStream(true);
                Process process = pb.start();

                StringBuilder output = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        output.append(line).append("\n");
                    }
                }

                int exitCode = process.waitFor();
                if (exitCode != 0) {
                    log.warn("Git clone failed with exit code {}: {}", exitCode, output);
                    return ResponseEntity.ok(RepoAnalysisDTO.Response.builder()
                            .error("Failed to clone repository. Ensure the URL is correct and the repo is public. Git output: " + output.toString().trim())
                            .apps(List.of())
                            .build());
                }
            }

            // Extract repo name
            String repoName = request.getRepoUrl().replaceAll(".*/", "").replace(".git", "");

            // Scan for apps
            List<RepoAnalysisDTO.DetectedApp> apps = scanDirectory(tempDir.toFile(), "");

            // If no apps detected in subdirectories, scan root
            if (apps.isEmpty()) {
                RepoAnalysisDTO.DetectedApp rootApp = detectApp(tempDir.toFile(), ".");
                if (rootApp != null) {
                    rootApp.setName(repoName);
                    apps.add(rootApp);
                }
            }

            log.info("Repo analysis complete. Detected {} app(s)", apps.size());

            return ResponseEntity.ok(RepoAnalysisDTO.Response.builder()
                    .repoName(repoName)
                    .apps(apps)
                    .build());

        } catch (Exception e) {
            log.error("Repo analysis failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(RepoAnalysisDTO.Response.builder()
                    .error("Analysis failed: " + e.getMessage())
                    .apps(List.of())
                    .build());
        } finally {
            // Cleanup temp directory
            if (tempDir != null) {
                try {
                    try (Stream<Path> walk = Files.walk(tempDir)) {
                        walk.sorted(Comparator.reverseOrder())
                                .map(Path::toFile)
                                .forEach(File::delete);
                    }
                    log.info("Cleaned up temp directory: {}", tempDir);
                } catch (Exception e) {
                    log.warn("Failed to cleanup temp directory: {}", e.getMessage());
                }
            }
        }
    }

    private List<RepoAnalysisDTO.DetectedApp> scanDirectory(File root, String parentPath) {
        List<RepoAnalysisDTO.DetectedApp> apps = new ArrayList<>();
        File[] children = root.listFiles();
        if (children == null) return apps;

        for (File child : children) {
            if (!child.isDirectory()) continue;
            if (child.getName().startsWith(".")) continue; // Skip hidden dirs
            if (child.getName().equals("node_modules") || child.getName().equals("target") ||
                child.getName().equals("build") || child.getName().equals("dist") ||
                child.getName().equals("__pycache__") || child.getName().equals("venv")) continue;

            String relativePath = parentPath.isEmpty() ? child.getName() + "/" : parentPath + child.getName() + "/";
            RepoAnalysisDTO.DetectedApp app = detectApp(child, relativePath);
            if (app != null) {
                apps.add(app);
            }
        }
        return apps;
    }

    private RepoAnalysisDTO.DetectedApp detectApp(File dir, String srcPath) {
        boolean hasPom = new File(dir, "pom.xml").exists();
        boolean hasGradle = new File(dir, "build.gradle").exists() || new File(dir, "build.gradle.kts").exists();
        boolean hasPackageJson = new File(dir, "package.json").exists();
        boolean hasRequirements = new File(dir, "requirements.txt").exists();
        boolean hasPyproject = new File(dir, "pyproject.toml").exists();
        boolean hasGoMod = new File(dir, "go.mod").exists();
        boolean hasDockerfile = new File(dir, "Dockerfile").exists();
        boolean hasNginxConf = new File(dir, "nginx.conf").exists() ||
                               new File(dir, "nginx").exists() ||
                               new File(dir, "default.conf").exists();

        String name = dir.getName(); // fallback
        String type = null;
        String framework = null;

        if (hasPom || hasGradle) {
            type = "BACKEND";
            framework = "Java Spring Boot";
            if (hasPom) {
                String artifactId = extractXmlTag(new File(dir, "pom.xml"), "artifactId");
                if (artifactId != null) name = artifactId;
            }
        } else if (hasPackageJson) {
            framework = detectJsFramework(new File(dir, "package.json"));
            String pkgName = extractJsonField(new File(dir, "package.json"), "name");
            if (pkgName != null && !pkgName.isBlank()) name = pkgName.replaceAll("^@[^/]+/", "");

            if (framework != null && (framework.equals("React") || framework.equals("Vue.js") || 
                framework.equals("Angular") || framework.equals("Next.js") || framework.equals("Nuxt.js"))) {
                type = "FRONTEND";
            } else {
                type = "BACKEND";
                if (framework == null) framework = "Node.js";
            }
        } else if (hasRequirements || hasPyproject) {
            type = "BACKEND";
            framework = "Python";
            if (hasPyproject) {
                String projName = extractTomlProjectName(new File(dir, "pyproject.toml"));
                if (projName != null) name = projName;
            }
        } else if (hasGoMod) {
            type = "BACKEND";
            framework = "Go";
            String modName = extractGoModuleName(new File(dir, "go.mod"));
            if (modName != null) name = modName;
        }

        if (type == null) return null;

        return RepoAnalysisDTO.DetectedApp.builder()
                .name(name)
                .type(type)
                .framework(framework)
                .srcPath(srcPath)
                .hasDockerfile(hasDockerfile)
                .hasNginxConf(hasNginxConf)
                .build();
    }

    private String detectJsFramework(File packageJson) {
        try {
            String content = Files.readString(packageJson.toPath());
            String lower = content.toLowerCase();
            if (lower.contains("\"react\"") || lower.contains("\"react-dom\"")) return "React";
            if (lower.contains("\"vue\"")) return "Vue.js";
            if (lower.contains("\"@angular/core\"")) return "Angular";
            if (lower.contains("\"next\"")) return "Next.js";
            if (lower.contains("\"nuxt\"")) return "Nuxt.js";
            if (lower.contains("\"express\"") || lower.contains("\"fastify\"") || lower.contains("\"@nestjs/core\"")) return "Node.js";
            return "Node.js";
        } catch (Exception e) { return "Node.js"; }
    }

    /** Extract first top-level occurrence of an XML tag (e.g. artifactId from pom.xml) */
    private String extractXmlTag(File file, String tag) {
        try {
            String content = Files.readString(file.toPath());
            // Skip parent block to get the project's own artifactId
            String noParent = content.replaceAll("(?s)<parent>.*?</parent>", "");
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("<" + tag + ">([^<]+)</" + tag + ">").matcher(noParent);
            if (m.find()) return m.group(1).trim();
        } catch (Exception ignored) {}
        return null;
    }

    /** Extract "name" field from package.json */
    private String extractJsonField(File file, String field) {
        try {
            String content = Files.readString(file.toPath());
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("\"" + field + "\"\\s*:\\s*\"([^\"]+)\"").matcher(content);
            if (m.find()) return m.group(1).trim();
        } catch (Exception ignored) {}
        return null;
    }

    /** Extract module name from go.mod (first line: module github.com/org/name) */
    private String extractGoModuleName(File file) {
        try {
            String firstLine = Files.readAllLines(file.toPath()).stream().filter(l -> l.startsWith("module ")).findFirst().orElse(null);
            if (firstLine != null) {
                String mod = firstLine.replace("module ", "").trim();
                return mod.contains("/") ? mod.substring(mod.lastIndexOf('/') + 1) : mod;
            }
        } catch (Exception ignored) {}
        return null;
    }

    /** Extract project name from pyproject.toml [project] name = "..." */
    private String extractTomlProjectName(File file) {
        try {
            for (String line : Files.readAllLines(file.toPath())) {
                String trimmed = line.trim();
                if (trimmed.startsWith("name") && trimmed.contains("=")) {
                    return trimmed.split("=", 2)[1].trim().replace("\"", "").replace("'", "");
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private String resolveGitExecutable() {
        // 1. Try configured executable
        if (canRun(gitExecutable)) return gitExecutable;
        
        // 2. Try default "git"
        if (!gitExecutable.equals("git") && canRun("git")) return "git";
        
        // 3. Try common Linux paths
        String[] commonPaths = {
            "/usr/bin/git",
            "/usr/local/bin/git",
            "/usr/bin/git-core/git"
        };
        for (String path : commonPaths) {
            if (new File(path).exists() && canRun(path)) return path;
        }
        
        return gitExecutable; // fallback to whatever was configured
    }

    private boolean canRun(String cmd) {
        try {
            new ProcessBuilder(cmd, "--version").start().waitFor();
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
