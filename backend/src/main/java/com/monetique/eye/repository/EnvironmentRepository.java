package com.monetique.eye.repository;

import com.monetique.eye.entity.Environment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EnvironmentRepository extends JpaRepository<Environment, Long> {
    java.util.Optional<Environment> findByName(String name);
}
