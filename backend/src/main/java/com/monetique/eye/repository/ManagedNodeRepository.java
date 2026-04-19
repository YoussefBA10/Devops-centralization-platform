package com.monetique.eye.repository;

import com.monetique.eye.entity.Environment;
import com.monetique.eye.entity.ManagedNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ManagedNodeRepository extends JpaRepository<ManagedNode, Long> {
    Optional<ManagedNode> findByEnvironmentAndIp(Environment environment, String ip);
}
