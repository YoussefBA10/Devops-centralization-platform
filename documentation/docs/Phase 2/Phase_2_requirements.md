# Phase 2: Security, RBAC & Ansible/GitOps Integration

**Monetique-Eye Platform**  
**Status**: Planning & Implementation  
**Environment**: JDK 21 (LTS) | Spring Boot 3.3 | MySQL 8.0

## 1. Phase 1 Fixes Applied

- **JDK Standardization**: Changed from JDK 25 to **JDK 21 LTS** for full compatibility with Spring Boot 3.3, jjwt, and Hibernate.
- **Lombok Decision**: Re-enabled **Project Lombok** with proper annotation processor configuration (cleaner code, no boilerplate). Lombok works perfectly with JDK 21.
- **Scope Clarification**: Phase 1 is now strictly limited to **Entities + Database + DataInitializer**. Security and Deployment logic moved to Phase 2.
- **Entity Consistency**: Confirmed exact 10 entities with clear Environment-first scoping.
- **Security Foundation**: JWT implementation will be done cleanly in this phase (no overlap with Phase 1).

## 2. Phase 2 Objectives

Build production-grade security layer and integrate the existing GitOps repository for **one-click automated deployment**.

### Key Deliverables

#### 2.1 Security & RBAC (Stateless JWT)
- Full JWT authentication with `jjwt` library
- BCrypt password encoding
- `User` entity implements `UserDetails`
- `JwtRequestFilter` + `OncePerRequestFilter`
- Role-based access (ADMIN vs USER)
- Environment-level authorization (`@PreAuthorize` + custom `SecurityService`)
- Login endpoint: `POST /api/auth/login`

#### 2.2 DeploymentService (Ansible/GitOps Integration)
- `DeploymentService.java` – the core of the one-click feature
- Execute your existing GitOps scripts safely:
  - `scripts/ssh-configure.sh`
  - Dynamic generation of `ansible/inventory.ini`
  - `ansible-playbook deploy-tools.yml` (for monitoring stack)
  - `ansible-playbook deploy-backend.yml` + `deploy-frontend.yml` (for application)
- Poll Prometheus for node registration
- Auto-create `Environment` + `Application` records after successful deployment
- Full audit logging via `DeploymentLog` entity

#### 2.3 Environment & Ticket Controllers
- `EnvironmentController.java` with deployment endpoints:
  - `POST /api/environments/{id}/deploy-agent`
  - `POST /api/environments/{id}/deploy-application`
- `TicketController.java` with basic CRUD + status updates

#### 2.4 Configuration & Security Hardening
- CORS configuration
- Password encoding with `BCryptPasswordEncoder`
- JWT secret from `.env`
- Secure filter chain order

## 3. Technical Specifications

- **JWT Claims**: Will contain `userId`, `role`, and `environmentIds` list
- **Deployment Execution**: Use `ProcessBuilder` with restricted permissions and timeout
- **Error Handling**: Graceful failure with detailed `DeploymentLog` entries
- **Idempotency**: Ansible playbooks are already idempotent – we leverage this
- **Logging**: All deployment steps logged at INFO level + full output captured

## 4. Implementation Order (Recommended)

1. Add JWT dependencies to `pom.xml` (`jjwt-api`, `jjwt-impl`, `jjwt-jackson`)
2. Implement `JwtUtil.java`, `JwtRequestFilter.java`, `SecurityConfig.java`
3. Update `User` entity to implement `UserDetails`
4. Create `SecurityService.java` for environment access checks
5. Implement `DeploymentService.java` (core logic)
6. Create `EnvironmentController.java` with deployment endpoints
7. Add basic `TicketController.java`
8. Test full flow:
   - Login as ADMIN
   - Create Environment
   - Trigger deployment
   - Verify node appears + records created

## 5. Verification Plan

- **Security**: Login → receive valid JWT → access protected endpoints (403 for unauthorized)
- **Deployment**: Trigger deploy-agent → check logs → verify Environment status updated → check Prometheus targets
- **RBAC**: USER role can only see assigned Environments (403 on others)
- **Database**: Verify `deployment_logs` table contains full execution history

---

**Next Phase**: Phase 3 – Real-time Observability (Prometheus + Elasticsearch + Stability Engine)

**Approval Required**:  
Please review this Phase 2 plan. Once you confirm, I will deliver:
- Full code for `SecurityConfig.java`, `JwtUtil.java`, `JwtRequestFilter.java`
- Complete `DeploymentService.java` (with GitOps integration)
- Updated `pom.xml` with JWT dependencies