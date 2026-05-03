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
        
        List<Map<String, Object>> scrapeConfigs = new ArrayList<>();

        if (!links.isEmpty()) {
            Map<String, Object> blackboxJob = new LinkedHashMap<>();
            blackboxJob.put("job_name", "blackbox_probe");
            blackboxJob.put("metrics_path", "/probe");
            blackboxJob.put("scrape_interval", "30s");

            List<Map<String, Object>> staticConfigs = new ArrayList<>();

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
                labels.put("link_id", link.getId());
                labels.put("link_name", link.getName() != null ? link.getName() : "");
                labels.put("source_vm", link.getSourceVm().getId());
                labels.put("target_vm", link.getTargetVm().getId());
                labels.put("env", link.getSourceVm().getEnv());
                labels.put("cluster", String.valueOf(link.getSourceVm().getCluster().getId()));
                
                // Add probe params as labels that we will relabel later, or group by module
                // Actually Prometheus allows params at the job level. 
                // Wait, if different links have different modules, we need separate jobs or use relabeling for modules.
                // The spec says:
                //   params:
                //     module: ['<link.probe_module>']
                // This implies we should group targets by probe_module into separate jobs, e.g. 'blackbox_probe_http_2xx'.
                // Let's modify the generation to group by module.
            }
            
            // Re-evaluating: group by probe_module
            Map<String, List<ServiceLink>> moduleGroups = new HashMap<>();
            for (ServiceLink link : links) {
                if (link.getEnabled()) {
                    moduleGroups.computeIfAbsent(link.getProbeModule(), k -> new ArrayList<>()).add(link);
                }
            }

            for (Map.Entry<String, List<ServiceLink>> entry : moduleGroups.entrySet()) {
                String module = entry.getKey();
                List<ServiceLink> moduleLinks = entry.getValue();

                Map<String, Object> job = new LinkedHashMap<>();
                job.put("job_name", "blackbox_probe_" + module);
                job.put("metrics_path", "/probe");
                job.put("scrape_interval", "30s");
                
                Map<String, Object> params = new HashMap<>();
                params.put("module", Collections.singletonList(module));
                job.put("params", params);

                List<Map<String, Object>> moduleStaticConfigs = new ArrayList<>();
                for (ServiceLink link : moduleLinks) {
                    Map<String, Object> targetConfig = new LinkedHashMap<>();
                    String targetUrl = String.format("%s://%s:%d%s", 
                        link.getProtocol(), 
                        link.getTargetVm().getIpAddress(), 
                        link.getTargetPort(), 
                        link.getTargetPath() != null ? link.getTargetPath() : "");
                    
                    targetConfig.put("targets", Collections.singletonList(targetUrl));
                    
                    Map<String, String> labels = new LinkedHashMap<>();
                    labels.put("link_id", link.getId());
                    labels.put("link_name", link.getName() != null ? link.getName() : "");
                    labels.put("source_vm", link.getSourceVm().getId());
                    labels.put("target_vm", link.getTargetVm().getId());
                    labels.put("env", link.getSourceVm().getEnv());
                    labels.put("cluster", String.valueOf(link.getSourceVm().getCluster().getId()));
                    
                    targetConfig.put("labels", labels);
                    moduleStaticConfigs.add(targetConfig);
                }
                job.put("static_configs", moduleStaticConfigs);

                List<Map<String, Object>> relabelConfigs = new ArrayList<>();
                relabelConfigs.add(createRelabelConfig(Collections.singletonList("__address__"), "__param_target", null));
                relabelConfigs.add(createRelabelConfig(Collections.singletonList("__param_target"), "instance", null));
                relabelConfigs.add(createRelabelConfig(null, "__address__", "localhost:9115"));
                
                job.put("relabel_configs", relabelConfigs);
                
                scrapeConfigs.add(job);
            }
        }

        Yaml yaml = new Yaml();
        return yaml.dumpAsMap(Collections.singletonMap("scrape_configs", scrapeConfigs));
    }

    private Map<String, Object> createRelabelConfig(List<String> sourceLabels, String targetLabel, String replacement) {
        Map<String, Object> map = new LinkedHashMap<>();
        if (sourceLabels != null) map.put("source_labels", sourceLabels);
        if (targetLabel != null) map.put("target_label", targetLabel);
        if (replacement != null) map.put("replacement", replacement);
        return map;
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
