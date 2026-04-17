package com.monetique.eye.controller;

import com.monetique.eye.dto.StabilityResponse;
import com.monetique.eye.service.InfrastructureService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/infrastructure/global")
@RequiredArgsConstructor
public class GlobalInfrastructureController {

    private final InfrastructureService infrastructureService;

    @GetMapping("/stability")
    public StabilityResponse getGlobalStability() {
        return infrastructureService.getGlobalStability();
    }
}
