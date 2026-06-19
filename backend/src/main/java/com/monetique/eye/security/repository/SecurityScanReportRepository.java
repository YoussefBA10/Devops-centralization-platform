package com.monetique.eye.security.repository;

import com.monetique.eye.security.entity.SecurityScanReport;
import com.monetique.eye.security.entity.enums.ReportComponent;
import com.monetique.eye.security.entity.enums.ReportType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface SecurityScanReportRepository extends JpaRepository<SecurityScanReport, Long> {
    Page<SecurityScanReport> findByApplicationId(Long applicationId, Pageable pageable);

    List<SecurityScanReport> findByApplicationIdAndUploadedAtAfterOrderByUploadedAtAsc(
            Long applicationId, LocalDateTime since);

    List<SecurityScanReport> findByApplicationIdOrderByUploadedAtAsc(Long applicationId);

    @Query("SELECT r FROM SecurityScanReport r JOIN FETCH r.application a JOIN a.environment e " +
           "WHERE (:clusterId IS NULL OR e.cluster.id = :clusterId) ORDER BY r.uploadedAt ASC")
    List<SecurityScanReport> findByClusterIdOrderByUploadedAtAsc(@Param("clusterId") Long clusterId);
    
    Optional<SecurityScanReport> findFirstByApplicationIdAndComponentAndReportTypeOrderByUploadedAtDesc(
            Long applicationId, ReportComponent component, ReportType reportType);
            
    // For trend calculation - find the scan before the current one
    Optional<SecurityScanReport> findFirstByApplicationIdAndComponentAndReportTypeAndIdNotOrderByUploadedAtDesc(
            Long applicationId, ReportComponent component, ReportType reportType, Long id);
}
