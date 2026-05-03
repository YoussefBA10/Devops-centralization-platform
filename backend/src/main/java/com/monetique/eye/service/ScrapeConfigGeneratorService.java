package com.monetique.eye.service;

import com.monetique.eye.entity.ServiceLink;
import com.monetique.eye.repository.ServiceLinkRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.yaml.snakeyaml.Yaml;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScrapeConfigGeneratorService {

    private final ServiceLinkRepository serviceLinkRepository;
    private final RestTemplate restTemplate;

    @Value("${monitoring.prometheus.conf-dir:/opt/monitoring/prometheus/conf.d}")
    private String confDir;

    @Value("${monitoring.prometheus.reload-url:http://localhost:9090/-/reload}")
    private String prometheusReloadUrl;

    @Value("${monitoring.blackbox-exporter.url:blackbox-exporter:9115}")
    private String blackboxExporterUrl;

    public void generateAndReload() {
        log.info("Generating Prometheus scrape configuration for network monitor...");
        try {
            String yamlContent = generateYaml();
            validateYaml(yamlContent);
            writeAtomically(yamlContent);
            reloadPrometheus();
        } catch (Exception e) {
            log.error("Failed to generate or reload Prometheus config: {}", e.getMessage(), e);
            throw new RuntimeException("Scrape config generation failed: " + e.getMessage(), e);
        }
    }

    private String generateYaml() {
        List<ServiceLink> links = serviceLinkRepository.findAll();
        List<Map<String, Object>> fileSdConfigs = new ArrayList<>();

        for (ServiceLink link : links) {
            if (!link.getEnabled()) continue;

            Map<String, Object> targetConfig = new LinkedHashMap<>();
            String targetUrl = String.format("%s://%s:%d%s", 
                link.getProtocol(), 
                link.getTargetVm().getIpAddress(), 
                link.getTargetPort(), 
                link.getTargetPath() != null ? link.getTargetPath() : "");
            
            targetConfig.put("targets", Collections.singletonList(targetUrl));
            
            Map<String, String> labels = new LinkedHashMap<>();
            labels.put("probe_module", link.getProbeModule());
            labels.put("link_id", link.getId());
            labels.put("link_name", link.getName() != null ? link.getName() : "");
            labels.put("source_vm", link.getSourceVm().getId());
            labels.put("target_vm", link.getTargetVm().getId());
            labels.put("env", link.getSourceVm().getEnv());
            labels.put("cluster", String.valueOf(link.getSourceVm().getCluster().getId()));
            
            targetConfig.put("labels", labels);
            fileSdConfigs.add(targetConfig);
        }

        Yaml yaml = new Yaml();
        return yaml.dump(fileSdConfigs);
    }

    private void validateYaml(String yamlContent) {
        try {
            Yaml yaml = new Yaml();
            yaml.load(yamlContent);
        } catch (Exception e) {
            throw new RuntimeException("Generated YAML is invalid", e);
        }
    }

    private void writeAtomically(String content) throws IOException {
        File dir = new File(confDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }
        
        Path finalPath = Paths.get(confDir, "network_monitor.yml");
        Path tmpPath = Paths.get(confDir, "network_monitor.yml.tmp");
        
        try (FileWriter writer = new FileWriter(tmpPath.toFile())) {
            writer.write(content);
        }
        
        Files.move(tmpPath, finalPath, StandardCopyOption.REPLACE_EXISTING);
        log.info("Wrote scrape config to {}", finalPath);
    }

    private void reloadPrometheus() {
        try {
            HttpHeaders headers = new HttpHeaders();
            HttpEntity<String> entity = new HttpEntity<>(null, headers);
            ResponseEntity<String> response = restTemplate.exchange(prometheusReloadUrl, HttpMethod.POST, entity, String.class);
            
            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new RuntimeException("Prometheus returned non-2xx: " + response.getStatusCode() + " body: " + response.getBody());
            }
            log.info("Prometheus successfully reloaded.");
        } catch (Exception e) {
            log.error("Error reloading Prometheus: {}", e.getMessage());
            throw new RuntimeException("Prometheus reload failed: " + e.getMessage(), e);
        }
    }
}
