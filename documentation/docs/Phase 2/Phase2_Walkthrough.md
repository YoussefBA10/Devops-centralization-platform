# Phase 2 Walkthrough: Security & GitOps Implementation

This document summarizes the core implementations for Phase 2, focusing on the Multi-Tenant RBAC security model and the GitOps deployment automation.

## 1. Multi-Tenant Security (RBAC)
- **Identity Provider**: Spring Security with JWT (Stateless).
- **Roles**:
    - `ADMIN`: Global access to all environments and system settings.
    - `USER`: Restricted to environments explicitly assigned via the `user_environments` mapping.
- **Dynamic Authorization**: Implemented `SecurityService` with `@PreAuthorize` hooks to validate environment ownership at the controller level.

## 2. GitOps Deployment Pipeline
- **Agent Orchestration**: `DeploymentService` utilizes SSH-based configuration scripts (`ssh-configure.sh`) to provision remote nodes.
- **Audit Logging**: Every deployment action is captured in the `deployment_logs` table, tracking status, target IP, and execution logs.
- **Infrastructure stubs**: Integrated topology and heatmap endpoints to visualize the state of the GitOps-managed cluster.

## 3. Data Persistence
- **Database**: MySQL 8.0 with JPA/Hibernate.
- **Initialization**: Automated `DataInitializer` ensures a default `admin` user and `Production` environment are available on first boot.

---
*Status: Verified and Integrated with Phase 3 Test Suite.*
