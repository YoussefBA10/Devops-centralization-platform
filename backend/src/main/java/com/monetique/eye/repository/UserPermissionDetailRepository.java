package com.monetique.eye.repository;

import com.monetique.eye.entity.UserPermissionDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UserPermissionDetailRepository extends JpaRepository<UserPermissionDetail, Long> {
    Optional<UserPermissionDetail> findByUserId(String userId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("delete from UserPermissionDetail d where d.userId = ?1")
    void deleteByUserId(String userId);
}
