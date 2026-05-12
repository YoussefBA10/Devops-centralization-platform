package com.monetique.eye.repository;

import com.monetique.eye.entity.Environment;
import com.monetique.eye.entity.ManagedNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ManagedNodeRepository extends JpaRepository<ManagedNode, Long> {
    java.util.List<ManagedNode> findByEnvironment_Cluster_IdAndEnvironment_Id(Long clusterId, Long envId);
    java.util.List<ManagedNode> findByEnvironment_Cluster_Id(Long clusterId);
    java.util.List<ManagedNode> findByEnvironment(Environment environment);
    Optional<ManagedNode> findByEnvironmentAndIp(Environment environment, String ip);
    Optional<ManagedNode> findByEnvironmentAndNodeName(Environment environment, String nodeName);
    long countByEnvironment(Environment environment);
}
