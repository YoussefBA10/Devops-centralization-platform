package com.monetique.eye.controller;

import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/v1/version")
@RequiredArgsConstructor
public class SystemVersionController {

    private final org.springframework.boot.info.BuildProperties buildProperties;

    @GetMapping
    public SystemVersion getVersion() {
        return SystemVersion.builder()
                .version(buildProperties != null ? buildProperties.getVersion() : "2.0.0-SNAPSHOT")
                .status("Production Ready")
                .author("Monetique Team")
                .buildTime(buildProperties != null ? buildProperties.getTime().toString() : LocalDateTime.now().toString())
                .build();
    }

    @Data
    @Builder
    public static class SystemVersion {
        private String version;
        private String status;
        private String author;
        private String buildTime;
    }
}
