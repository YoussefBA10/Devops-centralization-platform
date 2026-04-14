package com.monetique.eye.controller;

import com.monetique.eye.entity.User;
import com.monetique.eye.repository.UserRepository;
import com.monetique.eye.service.AuthenticationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationService authService;
    private final UserRepository userRepository;

    public AuthController(AuthenticationService authService, UserRepository userRepository) {
        this.authService = authService;
        this.userRepository = userRepository;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String token = authService.authenticate(username, request.get("password"));
        
        User user = userRepository.findByUsername(username).orElseThrow();
        
        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("user", Map.of(
            "id", user.getId(),
            "username", user.getUsername(),
            "role", user.getRole()
        ));
        
        return ResponseEntity.ok(response);
    }
}
