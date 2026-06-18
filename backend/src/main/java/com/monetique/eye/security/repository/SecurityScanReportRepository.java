package com.monetique.eye.security.repository;

import com.monetique.eye.security.entity.SecurityScanReport;
import com.monetique.eye.security.entity.enums.ReportComponent;
import com.monetique.eye.security.entity.enums.ReportType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SecurityScanReportRepository extends JpaRepository<SecurityScanReport, Long> {
    Page<SecurityScanReport> findByApplicationId(Long applicationId, Pageable pageable);
    
    Optional<SecurityScanReport> findFirstByApplicationIdAndComponentAndReportTypeOrderByUploadedAtDesc(
            Long applicationId, ReportComponent component, ReportType reportType);
            
    // For trend calculation - find the scan before the current one
    Optional<SecurityScanReport> findFirstByApplicationIdAndComponentAndReportTypeAndIdNotOrderByUploadedAtDesc(
            Long applicationId, ReportComponent component, ReportType reportType, Long id);
}
