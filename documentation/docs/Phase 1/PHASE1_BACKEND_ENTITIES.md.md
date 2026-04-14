# Phase 1: Backend – Core Entities & Database

**Monetique-Eye Platform**  
**Goal**: Create the 10 clean JPA entities with proper relationships and multi-tenant scoping.

> Last Updated: April 2026  
> Keep it minimal, secure, and strictly scoped by Environment → Application.

## 1. Objectives of Phase 1

- Define exactly **10 JPA entities**
- Establish correct relationships (Environment is the new root)
- Implement proper multi-tenant isolation
- Prepare for RBAC and automated deployment
- Use MySQL 8.0 with Spring Data JPA + Hibernate

## 2. Entity Overview (10 Entities Only)

| Entity                    | Purpose                                      | Key Relationships                     |
|---------------------------|----------------------------------------------|---------------------------------------|
| `Environment`             | Top-level container (Prod-ClientX, etc.)     | 1 → * Application, 1 → * Ticket      |
| `Application`             | Hosted application inside an Environment     | ManyToOne Environment                 |
| `User`                    | System users with RBAC                       | ManyToMany Environment                |
| `Ticket`                  | Ticket management module                     | ManyToOne Environment + Application   |
| `DeploymentLog`           | Audit trail for one-click deployments        | ManyToOne Environment                 |
| `LogAggregationWindow`    | Stability scoring data                       | ManyToOne Application                 |
| `RecurringPattern`        | Log pattern detection                        | ManyToOne Application                 |
| `Incident`                | Auto-detected or manual incidents            | ManyToOne Application                 |
| `AiOperationalSummary`    | Groq AI executive digest                     | ManyToOne Application                 |
| `Conversation`            | AI Chat history                              | ManyToOne Application (optional)      |

## 3. Detailed Entity Specifications

### Environment.java
```java
@Entity
@Table(name = "environments")
public class Environment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    private String description;
    private String prometheusLabel;        // Used for auto-discovery

    @Enumerated(EnumType.STRING)
    private DeploymentStatus lastDeploymentStatus;

    private LocalDateTime lastDeployedAt;
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "environment", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Application> applications = new HashSet<>();

    @OneToMany(mappedBy = "environment", cascade = CascadeType.ALL)
    private Set<Ticket> tickets = new HashSet<>();

    @OneToMany(mappedBy = "environment")
    private Set<DeploymentLog> deploymentLogs = new HashSet<>();
}
Application.java
Java@Entity
@Table(name = "applications")
public class Application {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "environment_id", nullable = false)
    private Environment environment;

    @Column(nullable = false)
    private String name;

    private String serviceNameKeyword;   // Used to filter Prometheus & Elasticsearch
}
User.java
Java@Entity
@Table(name = "users")
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    private String password;

    @Enumerated(EnumType.STRING)
    private Role role;                   // ADMIN or USER

    @ManyToMany
    @JoinTable(name = "user_environments",
               joinColumns = @JoinColumn(name = "user_id"),
               inverseJoinColumns = @JoinColumn(name = "environment_id"))
    private Set<Environment> environments = new HashSet<>();
}
Ticket.java
Java@Entity
@Table(name = "tickets")
public class Ticket {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "environment_id", nullable = false)
    private Environment environment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id")
    private Application application;     // Optional

    private String title;
    private String description;

    @Enumerated(EnumType.STRING)
    private TicketStatus status;

    @ManyToOne
    private User createdBy;

    @ManyToOne
    private User assignedTo;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
DeploymentLog.java (Audit Trail)
Java@Entity
@Table(name = "deployment_logs")
public class DeploymentLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "environment_id", nullable = false)
    private Environment environment;

    private String action;               // "DEPLOY_AGENT" or "DEPLOY_APPLICATION"
    private String targetIp;
    private String status;               // SUCCESS / FAILED
    private String logOutput;

    @ManyToOne
    private User executedBy;

    private LocalDateTime executedAt;
}
Other Supporting Entities (Minimal)

LogAggregationWindow.java
RecurringPattern.java
Incident.java
AiOperationalSummary.java
Conversation.java

(They follow the same pattern: ManyToOne Application)
4. Enums
Create in entity/enums/ folder:
Javapublic enum Role {
    ADMIN, USER
}

public enum TicketStatus {
    OPEN, IN_PROGRESS, RESOLVED, CLOSED, REOPENED, ESCALATED
}

public enum DeploymentStatus {
    PENDING, SUCCESS, FAILED, IN_PROGRESS
}
5. Next Actions After Creating Entities

Create corresponding Repository interfaces (extends JpaRepository)
Add @EntityScan and @EnableJpaRepositories in main application class
Configure application.yml with MySQL connection
Run the application with spring.jpa.hibernate.ddl-auto=update for initial schema creation
Create a DataInitializer.java to seed one default ADMIN user and one test Environment

6. Validation Rules (Enterprise Clean)

All data must be scoped by Environment
Application cannot exist without an Environment
Ticket requires Environment, Application is optional
User (USER role) can only see assigned Environments
Use FetchType.LAZY everywhere to avoid N+1 queries