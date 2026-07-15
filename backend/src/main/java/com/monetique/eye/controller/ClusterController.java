package com.monetique.eye.controller;

import com.monetique.eye.entity.Cluster;
import com.monetique.eye.entity.User;
import com.monetique.eye.entity.enums.Role;
import com.monetique.eye.repository.ClusterRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.security.RequiresPermission;
import com.monetique.eye.service.PermissionService;
import com.monetique.eye.service.SecurityService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/clusters")
public class ClusterController {

    private final ClusterRepository clusterRepository;
    private final EnvironmentRepository environmentRepository;
    private final SecurityService securityService;
    private final PermissionService permissionService;

    public ClusterController(ClusterRepository clusterRepository, 
                             EnvironmentRepository environmentRepository,
                             SecurityService securityService,
                             PermissionService permissionService) {
        this.clusterRepository = clusterRepository;
        this.environmentRepository = environmentRepository;
        this.securityService = securityService;
        this.permissionService = permissionService;
    }

    @GetMapping
    @RequiresPermission("ENV_DEPLOYMENT_VIEW")
    public List<Cluster> getAll() {
        User currentUser = securityService.getCurrentUser();
        List<Cluster> allClusters = clusterRepository.findAll();
        
        // Admins see all clusters
        if (currentUser != null && currentUser.getRole() == Role.ADMIN) {
            return allClusters;
        }
        
        // Regular users see only clusters they have access to
        if (currentUser != null) {
            Set<String> allowedIds = permissionService.getAllowedClusterIds(currentUser.getUsername())
                    .stream().collect(Collectors.toSet());
            return allClusters.stream()
                    .filter(c -> allowedIds.contains(String.valueOf(c.getId())))
                    .collect(Collectors.toList());
        }
        
        return List.of();
    }

    @PostMapping
    @RequiresPermission("ENV_DEPLOYMENT_CREATE")
    public Cluster create(@RequestBody Cluster cluster) {
        return clusterRepository.save(cluster);
    }

    @PutMapping("/{id}")
    @RequiresPermission("ENV_DEPLOYMENT_EDIT")
    public Cluster update(@PathVariable Long id, @RequestBody Cluster clusterDetails) {
        Cluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cluster not found"));
        cluster.setName(clusterDetails.getName());
        cluster.setDescription(clusterDetails.getDescription());
        return clusterRepository.save(cluster);
    }

    @DeleteMapping("/{id}")
    @RequiresPermission("ENV_DEPLOYMENT_DELETE")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        Cluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cluster not found"));
        
        // Unlink environments instead of deleting them? 
        // For now, let's just delete the cluster and allow environments to be orphan
        cluster.getEnvironments().forEach(env -> {
            env.setCluster(null);
            environmentRepository.save(env);
        });
        
        clusterRepository.delete(cluster);
        return ResponseEntity.ok().build();
    }
}

