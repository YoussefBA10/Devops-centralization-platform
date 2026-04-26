package com.monetique.eye.repository;

import com.monetique.eye.entity.Conversation;
import com.monetique.eye.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    List<Conversation> findByUserOrderByStartedAtDesc(User user);
}
