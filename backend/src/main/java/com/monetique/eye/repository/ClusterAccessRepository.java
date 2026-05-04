package com.monetique.eye.repository;

import com.monetique.eye.entity.ClusterAccess;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ClusterAccessRepository extends JpaRepository<ClusterAccess, Long> {
    List<ClusterAccess> findByUserId(String userId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("delete from ClusterAccess e where e.userId = ?1")
    void deleteByUserId(String userId);
    boolean existsByUserIdAndClusterId(String userId, String clusterId);
}
