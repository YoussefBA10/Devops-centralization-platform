package com.monetique.eye.service;

import com.monetique.eye.entity.User;
import com.monetique.eye.repository.UserRepository;
import com.monetique.eye.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SecurityService {

    private final UserRepository userRepository;
    private final ApplicationRepository applicationRepository;
    private final PermissionService permissionService;

    public boolean canAccessEnvironment(Long environmentId) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return permissionService.hasClusterAccess(username, environmentId.toString());
    }

    public boolean canAccessApplication(Long appId) {
        return applicationRepository.findById(appId)
                .map(app -> canAccessEnvironment(app.getEnvironment().getId()))
                .orElse(false);
    }

    public User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username).orElse(null);
    }
}
