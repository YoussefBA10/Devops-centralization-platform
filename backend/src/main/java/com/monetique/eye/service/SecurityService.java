package com.monetique.eye.service;

import com.monetique.eye.entity.User;
import com.monetique.eye.repository.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class SecurityService {

    private final UserRepository userRepository;

    public SecurityService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public boolean canAccessEnvironment(Long environmentId) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .map(user -> user.getRole().name().equals("ADMIN") || 
                             user.getEnvironments().stream().anyMatch(e -> e.getId().equals(environmentId)))
                .orElse(false);
    }
}
