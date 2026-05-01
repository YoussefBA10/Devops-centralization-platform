package com.monetique.eye.controller;

import com.monetique.eye.entity.Cluster;
import com.monetique.eye.repository.ClusterRepository;
import com.monetique.eye.repository.EnvironmentRepository;
import com.monetique.eye.security.RequiresPermission;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/clusters")
public class ClusterController {

    private final ClusterRepository clusterRepository;
    private final EnvironmentRepository environmentRepository;

    public ClusterController(ClusterRepository clusterRepository, EnvironmentRepository environmentRepository) {
        this.clusterRepository = clusterRepository;
        this.environmentRepository = environmentRepository;
    }

    @GetMapping
    @RequiresPermission("ENV_DEPLOYMENT_VIEW")
    public List<Cluster> getAll() {
        return clusterRepository.findAll();
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
