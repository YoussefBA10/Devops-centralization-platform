package com.monetique.eye.repository;

import com.monetique.eye.entity.ServiceLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ServiceLinkRepository extends JpaRepository<ServiceLink, String> {
    
    @Query("SELECT sl FROM ServiceLink sl WHERE sl.sourceVm.cluster.id = :clusterId AND sl.sourceVm.env = :env AND sl.targetVm.cluster.id = :clusterId AND sl.targetVm.env = :env")
    List<ServiceLink> findByClusterIdAndEnv(Long clusterId, String env);
}
