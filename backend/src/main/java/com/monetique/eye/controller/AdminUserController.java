package com.monetique.eye.controller;

import com.monetique.eye.entity.User;
import com.monetique.eye.entity.enums.Role;
import com.monetique.eye.repository.UserRepository;
import com.monetique.eye.repository.UserPermissionRepository;
import com.monetique.eye.repository.UserPermissionDetailRepository;
import com.monetique.eye.repository.EnvironmentAccessRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserPermissionRepository userPermissionRepository;
    private final UserPermissionDetailRepository userPermissionDetailRepository;
    private final EnvironmentAccessRepository environmentAccessRepository;

    @GetMapping
    public List<Map<String, Object>> getAllUsers() {
        return userRepository.findAll().stream()
                .map(user -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", user.getId());
                    m.put("username", user.getUsername());
                    m.put("role", user.getRole() != null ? user.getRole().name() : "USER");
                    return m;
                })
                .collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<?> createUser(@RequestBody Map<String, String> payload) {
        String username = payload.get("username");
        String password = payload.get("password");
        String roleStr = payload.getOrDefault("role", "USER");

        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Username and password are required"));
        }

        if (userRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Username already exists"));
        }

        User user = User.builder()
                .username(username)
                .password(passwordEncoder.encode(password))
                .role(Role.valueOf(roleStr))
                .build();

        return ResponseEntity.ok(userRepository.save(user));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        return userRepository.findById(id).map(user -> {
            if (payload.containsKey("username")) user.setUsername(payload.get("username"));
            if (payload.containsKey("role")) user.setRole(Role.valueOf(payload.get("role")));
            if (payload.containsKey("password") && !payload.get("password").isBlank()) {
                user.setPassword(passwordEncoder.encode(payload.get("password")));
            }
            return ResponseEntity.ok(userRepository.save(user));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        return userRepository.findById(id).map(user -> {
            String username = user.getUsername();
            // Cleanup permissions before deleting user
            userPermissionRepository.deleteByUserId(username);
            userPermissionDetailRepository.deleteByUserId(username);
            environmentAccessRepository.deleteByUserId(username);
            
            userRepository.delete(user);
            return ResponseEntity.ok(Map.of("message", "User deleted successfully"));
        }).orElse(ResponseEntity.notFound().build());
    }
}
