# Monetique-Eye – All Architecture Diagrams

> Last Updated: April 2026

## 1. Overall Platform Context

```mermaid
C4Context
    title Monetique-Eye Platform Context Diagram

    Person(Admin, "Platform Admin", "Manages environments and deployments")
    Person(EndUser, "End User", "Monitors systems and manages tickets")

    System_Boundary(monetique, "Monetique-Eye Platform") {
        System_Ext(UI, "React Executive Dashboard", "Dark themed UI")
        System(Backend, "Spring Boot Backend", "Core API and Deployment Service")
        SystemDb(MySQL, "MySQL 8.0", "Entities and audit logs")
        SystemDb(ES, "Elasticsearch", "Enriched logs")
    }

    System_Ext(GitOps, "GitOps Repository", "Ansible playbooks and scripts")
    System_Ext(Prometheus, "Prometheus", "Metrics scraping")
    System_Ext(AgentNodes, "Client Agent Nodes", "cAdvisor and Filebeat")

    Admin --> UI
    EndUser --> UI
    UI --> Backend
    Backend --> GitOps
    Backend --> Prometheus
    Backend --> ES
    Backend --> MySQL
    GitOps --> AgentNodes
```

## 2. Automated Deployment Sequence
```mermaid
sequenceDiagram
    participant Admin as ADMIN (UI)
    participant BE as Backend
    participant GitOps as GitOps Repo
    participant Agent as Remote Agent Node
    participant Prom as Prometheus

    Admin->>BE: POST /api/environments/{id}/deploy
    BE->>BE: RBAC Check (ADMIN only)
    BE->>GitOps: ssh-configure.sh + dynamic inventory
    BE->>GitOps: ansible-playbook deploy-tools.yml
    GitOps->>Agent: Deploy monitoring stack
    Agent->>Prom: Register node with label
    BE->>Prom: Verify discovery
    BE->>DB: Create Environment + Application + DeploymentLog
    BE-->>Admin: Success + Live Refresh
```

## 3. Operational Intelligence Layout
```mermaid
graph TB
    subgraph "Hero Section"
        Stability["Stability Index Card (Z-Score)"]
        AIDigest["AI Executive Digest (Groq)"]
    end

    subgraph "Main Content"
        Heatmap["Service Risk Heatmap"]
        Signals["Critical Operational Signals"]
        Incidents["Active Incidents Table"]
    end

    subgraph "Analysis Section"
        Drift["Log Drift Analyzer"]
        Recurring["Recurring Issues Panel"]
    end

    Stability & AIDigest --> Incidents
    Heatmap & Signals --> Drift
```

## 4. Ticket Management Lifecycle
```mermaid
stateDiagram-v2
    [*] --> Open
    Open --> InProgress : Acknowledge
    InProgress --> Resolved : Fix Complete
    Resolved --> Closed : Verified
    Resolved --> Reopened : Not Satisfied
    Closed --> [*]
    Open --> Escalated
    InProgress --> Escalated
```

## 5. RBAC & Multi-Tenancy
```mermaid
graph TD
    subgraph "User Roles"
        Admin["ADMIN User"]
        RegularUser["USER"]
    end

    subgraph "Access Control"
        Security["SecurityService<br/>JWT + PreAuthorize"]
    end

    subgraph "Scoped Data"
        Data["Environment and Application Scoped Data<br/>(Metrics, Logs, Tickets, AI)"]
    end

    Admin --> Security
    RegularUser --> Security
    Security -->|Full Access| Data
    Security -->|Restricted to assigned Environments| Data 
```
