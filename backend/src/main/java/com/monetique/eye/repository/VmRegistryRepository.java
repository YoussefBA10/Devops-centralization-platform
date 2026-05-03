package com.monetique.eye.repository;

import com.monetique.eye.entity.VmRegistry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VmRegistryRepository extends JpaRepository<VmRegistry, String> {
    List<VmRegistry> findByClusterIdAndEnv(Long clusterId, String env);
    Optional<VmRegistry> findByIpAddressAndEnv(String ipAddress, String env);
}
