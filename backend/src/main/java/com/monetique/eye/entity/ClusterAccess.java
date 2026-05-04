package com.monetique.eye.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "cluster_access", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"userId", "clusterId"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClusterAccess {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String clusterId;
}
