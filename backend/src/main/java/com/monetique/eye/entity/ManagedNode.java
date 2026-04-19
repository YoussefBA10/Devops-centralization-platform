package com.monetique.eye.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "managed_nodes", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"environment_id", "ip"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ManagedNode {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String ip;

    private String nodeName;

    @Column(nullable = false)
    private String sshUser;

    @Column(nullable = false)
    private String sshPassword;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "environment_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @JsonIgnore
    private Environment environment;
}
