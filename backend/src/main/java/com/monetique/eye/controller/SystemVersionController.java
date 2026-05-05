package com.monetique.eye.controller;

import lombok.Builder;
import lombok.Data;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/v1/version")
public class SystemVersionController {

    @GetMapping
    public SystemVersion getVersion() {
        return SystemVersion.builder()
                .version("1.0.0")
                .status("Production Ready")
                .author("Monetique Team")
                .buildTime(LocalDateTime.now().toString())
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
