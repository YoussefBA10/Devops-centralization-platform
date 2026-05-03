package com.monetique.eye.repository;

import com.monetique.eye.entity.ServiceLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ServiceLinkRepository extends JpaRepository<ServiceLink, String> {
    
    @Query("SELECT sl FROM ServiceLink sl WHERE sl.sourceNode.environment.cluster.id = :clusterId AND sl.sourceNode.environment.id = :envId")
    List<ServiceLink> findByClusterIdAndEnvironmentId(Long clusterId, Long envId);

    @Query("SELECT sl FROM ServiceLink sl WHERE sl.sourceNode.environment.cluster.id = :clusterId")
    List<ServiceLink> findByClusterId(Long clusterId);
}
