package com.monetique.eye.repository;

import com.monetique.eye.entity.EnvironmentAccess;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface EnvironmentAccessRepository extends JpaRepository<EnvironmentAccess, Long> {
    List<EnvironmentAccess> findByUserId(String userId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("delete from EnvironmentAccess e where e.userId = ?1")
    void deleteByUserId(String userId);
    boolean existsByUserIdAndEnvironmentId(String userId, String environmentId);
}
