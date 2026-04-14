package com.monetique.eye.repository;

import com.monetique.eye.entity.Application;
import com.monetique.eye.entity.RecurringPattern;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RecurringPatternRepository extends JpaRepository<RecurringPattern, Long> {
    Optional<RecurringPattern> findByApplicationAndPatternHash(Application application, String patternHash);
}
