package com.monetique.eye.security.config;

import com.monetique.eye.security.service.SecurityReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class SecurityReportMigrationRunner implements ApplicationRunner {

    private final SecurityReportService securityReportService;

    @Override
    public void run(ApplicationArguments args) {
        try {
            int reassigned = securityReportService.reassignMisplacedReports();
            if (reassigned > 0) {
                log.info("Security report migration complete: {} report(s) reassigned", reassigned);
            }
        } catch (Exception e) {
            log.warn("Security report migration skipped or failed: {}", e.getMessage());
        }
    }
}
