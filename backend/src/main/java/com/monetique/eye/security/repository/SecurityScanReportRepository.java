package com.monetique.eye.security.repository;

import com.monetique.eye.security.dto.ReportCountProjection;
import com.monetique.eye.security.dto.ScanReportTrendProjection;
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

    @Query("SELECT r.uploadedAt AS uploadedAt, r.reportType AS reportType, r.buildNumber AS buildNumber, " +
           "r.criticalCount AS criticalCount, r.highCount AS highCount, r.mediumCount AS mediumCount, " +
           "r.lowCount AS lowCount, r.totalIssues AS totalIssues, a.name AS applicationName " +
           "FROM SecurityScanReport r JOIN r.application a " +
           "ORDER BY r.uploadedAt ASC")
    List<ScanReportTrendProjection> findAllTrendProjections();

    @Query("SELECT r.uploadedAt AS uploadedAt, r.reportType AS reportType, r.buildNumber AS buildNumber, " +
           "r.criticalCount AS criticalCount, r.highCount AS highCount, r.mediumCount AS mediumCount, " +
           "r.lowCount AS lowCount, r.totalIssues AS totalIssues, a.name AS applicationName " +
           "FROM SecurityScanReport r JOIN r.application a " +
           "WHERE a.id IN :applicationIds " +
           "ORDER BY r.uploadedAt ASC")
    List<ScanReportTrendProjection> findTrendProjectionsByApplicationIds(
            @Param("applicationIds") List<Long> applicationIds);

    @Query("SELECT r.uploadedAt AS uploadedAt, r.reportType AS reportType, r.buildNumber AS buildNumber, " +
           "r.criticalCount AS criticalCount, r.highCount AS highCount, r.mediumCount AS mediumCount, " +
           "r.lowCount AS lowCount, r.totalIssues AS totalIssues, a.name AS applicationName " +
           "FROM SecurityScanReport r JOIN r.application a JOIN a.environment e " +
           "WHERE (:clusterId IS NULL OR e.cluster.id = :clusterId) " +
           "ORDER BY r.uploadedAt ASC")
    List<ScanReportTrendProjection> findTrendProjectionsByClusterId(@Param("clusterId") Long clusterId);

    @Query("SELECT r.id AS id, r.criticalCount AS criticalCount, r.highCount AS highCount, " +
           "r.mediumCount AS mediumCount, r.lowCount AS lowCount " +
           "FROM SecurityScanReport r " +
           "WHERE r.application.id = :applicationId AND r.component = :component AND r.reportType = :reportType " +
           "ORDER BY r.uploadedAt DESC")
    List<ReportCountProjection> findLatestCountProjections(
            @Param("applicationId") Long applicationId,
            @Param("component") ReportComponent component,
            @Param("reportType") ReportType reportType,
            Pageable pageable);

    @Query("SELECT r.id AS id, r.criticalCount AS criticalCount, r.highCount AS highCount " +
           "FROM SecurityScanReport r " +
           "WHERE r.application.id = :applicationId AND r.component = :component AND r.reportType = :reportType " +
           "AND r.id <> :excludeId " +
           "ORDER BY r.uploadedAt DESC")
    List<ReportCountProjection> findPreviousCountProjections(
            @Param("applicationId") Long applicationId,
            @Param("component") ReportComponent component,
            @Param("reportType") ReportType reportType,
            @Param("excludeId") Long excludeId,
            Pageable pageable);

    Optional<SecurityScanReport> findFirstByApplicationIdAndComponentAndReportTypeOrderByUploadedAtDesc(
            Long applicationId, ReportComponent component, ReportType reportType);

    Optional<SecurityScanReport> findFirstByApplicationIdAndComponentAndReportTypeAndIdNotOrderByUploadedAtDesc(
            Long applicationId, ReportComponent component, ReportType reportType, Long id);
}
