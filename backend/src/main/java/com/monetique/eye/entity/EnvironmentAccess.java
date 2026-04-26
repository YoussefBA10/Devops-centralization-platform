package com.monetique.eye.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "environment_access", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"userId", "environmentId"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EnvironmentAccess {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String environmentId;
}
