package com.monetique.eye.repository;

import com.monetique.eye.entity.GitHubToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GitHubTokenRepository extends JpaRepository<GitHubToken, Long> {
    Optional<GitHubToken> findByUserId(String userId);
}
