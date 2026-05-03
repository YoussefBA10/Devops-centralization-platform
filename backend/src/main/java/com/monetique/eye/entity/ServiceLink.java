package com.monetique.eye.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

@Entity
@Table(name = "service_link")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServiceLink {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    @Column(updatable = false, nullable = false, length = 36)
    private String id;

    @Column(length = 200)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_vm_id", nullable = false)
    private VmRegistry sourceVm;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_vm_id", nullable = false)
    private VmRegistry targetVm;

    @Column(name = "target_port", nullable = false)
    private Integer targetPort;

    @Column(name = "target_path", length = 200)
    @Builder.Default
    private String targetPath = "/health";

    @Column(length = 10)
    @Builder.Default
    private String protocol = "http";

    @Column(name = "probe_module", length = 50)
    @Builder.Default
    private String probeModule = "http_2xx";

    @Builder.Default
    private Boolean enabled = true;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
