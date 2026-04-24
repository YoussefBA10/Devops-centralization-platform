package com.monetique.eye.repository;

import com.monetique.eye.entity.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long> {
    List<Ticket> findByEnvironmentId(Long environmentId);
    int countByStatus(String status);
}
