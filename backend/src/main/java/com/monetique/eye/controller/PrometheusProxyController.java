package com.monetique.eye.controller;

import com.monetique.eye.service.PrometheusClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/prometheus")
public class PrometheusProxyController {

    @Autowired
    private PrometheusClient prometheusClient;

    @GetMapping("/query")
    public Map<String, Object> query(@RequestParam String query) {
        return prometheusClient.proxyQuery(query);
    }

    @GetMapping("/query_range")
    public Map<String, Object> queryRange(
            @RequestParam String query,
            @RequestParam String start,
            @RequestParam String end,
            @RequestParam String step) {
        return prometheusClient.proxyQueryRange(query, start, end, step);
    }
}
