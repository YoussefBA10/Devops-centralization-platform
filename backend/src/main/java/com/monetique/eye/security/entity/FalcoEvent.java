package com.monetique.eye.security.entity;

import com.monetique.eye.entity.Incident;
import com.monetique.eye.entity.ManagedNode;
import com.monetique.eye.security.entity.enums.FalcoPriority;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "falco_events")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FalcoEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "node_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private ManagedNode node;

    private String ruleName;

    @Enumerated(EnumType.STRING)
    private FalcoPriority priority;

    @Column(columnDefinition = "TEXT")
    private String output;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "JSON")
    private Map<String, Object> outputFields;

    private String source;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "JSON")
    private List<String> tags;

    private LocalDateTime timestamp;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "incident_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Incident incident;
}
