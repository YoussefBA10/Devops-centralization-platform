# Phase 2: Security, RBAC & GitOps Integration – Walkthrough

**Monetique-Eye Observability Platform**  
**Status**: COMPLETED ✅  
**Environment**: JDK 21 LTS | Spring Boot 3.3 | MySQL 8.0

## 1. Overview
Phase 2 expanded the platform from a simple data model into a secure, automated system capable of deploying agents across a distributed infrastructure. This phase focused on production-grade security and one-click automation.

## 2. Key Accomplishments

### ⚙️ Environment & Tooling
- **JDK 21 LTS Core**: Standardized the platform on **JDK 21** for long-term support and full compatibility with the Spring ecosystem.
- **Lombok Integration**: Re-enabled **Project Lombok** across the domain model, resulting in a cleaner, maintainable codebase without manual boilerplate.

### 🔐 Security & Multi-Tenancy (Phase 2 Spec)
- **JwtUtil & JwtRequestFilter**: Implemented a specialized security pipeline that intercepts every request, validates the JWT, and enforces stateless session management.
- **RBAC (Role Based Access Control)**: Distributed users into roles (ADMIN/USER) with a dedicated **SecurityService** that performs environment-level checks. 
- **Environment Isolation**: Users can only see and deploy to the environments they are explicitly assigned to, while admins maintain global visibility.
- **Auth Endpoint**: Unified login path at `POST /api/auth/login`.

### 🚀 Automated Deployment Engine
- **DeploymentService**: A core integration service that bridges the Java backend with the **Ansible GitOps** repository.
- **One-Click Agent Deploy**: 
    - Dynamically generates the `ansible/inventory.ini`.
    - Coordinates the execution of `ssh-configure.sh` and `deploy-tools.yml` using asynchronous processes.
    - Captures real-time console output into the **DeploymentLog** entity for auditing and debugging.

### 📡 API Controllers
- **EnvironmentController**: Managed endpoints for environment creation and the `/deploy-agent` trigger.
- **TicketController**: Full CRUD for incident and maintenance ticket management, including environment-scoped authorization.

## 3. Technical Specifications
- **Build System**: Maven with explicit Lombok annotation processor configuration.
- **Execution**: Asynchronous `ProcessBuilder` with strict timeouts (300s-600s) to prevent resource hangs.
- **Identity**: `BCryptPasswordEncoder` for all stored credentials.

## 4. How to Verify
1. **Build**: Ensure the project is built with JDK 21:
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Java\jdk-21.0.9"
   mvn clean compile
   ```
2. **Access**: Login via `/api/auth/login` to obtain your Bearer token.
3. **Deploy**: POST to `/api/environments/{id}/deploy-agent` with a `targetIp` and verify the background process starts.
4. **Audit**: Query the `deployment_logs` table to see the full Ansible output captured by the service.

---
**Next Phase**: [Phase 3 – Real-time Observability Pipeline]
