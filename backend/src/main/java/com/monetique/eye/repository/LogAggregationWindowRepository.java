package com.monetique.eye.repository;

import com.monetique.eye.entity.LogAggregationWindow;
import com.monetique.eye.entity.Application;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface LogAggregationWindowRepository extends JpaRepository<LogAggregationWindow, Long> {
    List<LogAggregationWindow> findTop24ByApplicationOrderByWindowEndDesc(Application application);
    List<LogAggregationWindow> findTop24ByApplicationIdOrderByWindowEndDesc(Long applicationId);
}
