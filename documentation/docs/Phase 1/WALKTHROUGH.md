# Phase 1: Backend Foundation & Security – Walkthrough

**Monetique-Eye Observability Platform**  
**Status**: COMPLETED ✅  
**Environment**: JDK 25 | Spring Boot 3.3 | MySQL 8.0

## 1. Overview
In Phase 1, we established the bedrock of the Monetique-Eye platform. The goal was to create a secure, scalable, and environment-first data layer that supports multi-tenant isolation and automated deployments.

## 2. Key Accomplishments

### 🏗️ Project Infrastructure
- **Clean Architecture**: Initialized the `backend/` directory with a standard Maven structure.
- **JDK 25 Optimization**: Switched from Lombok to **Standard Java POJOs** to ensure 100% compatibility with the latest Java versions (fixing the `UNKNOWN` TypeTag compilation errors).
- **Environment Driven**: Configured `application.yml` to pull from `.env`, ensuring secrets (DB, JWT, Groq) are never hardcoded.

### 📊 Data Model (10 Core Entities)
We implemented a strict hierarchy where all data is scoped by **Environment**:
1.  **Environment**: The root container (e.g., "Production", "Staging").
2.  **Application**: Hosted services inside an environment.
3.  **User**: System users with RBAC (linked to specific Environments).
4.  **Ticket**: Integrated incident tracking.
5.  **DeploymentLog**: Audit trail for Ansible automation.
6.  **Incident**: Auto-detected system alerts.
7.  **LogAggregationWindow**: Stability scoring metrics.
8.  **RecurringPattern**: Log analytics data.
9.  **AiOperationalSummary**: Groq-generated executive digests.
10. **Conversation**: AI Assistant chat history.

### 🛡️ Security & Identity
- **Stateless JWT**: Implemented a production-grade authentication flow using `jjwt`.
- **BCrypt Hashing**: All user passwords (including the default `admin`) are secured using one-way cryptographic hashing.
- **RBAC Foundation**: The `User` entity now implements `UserDetails`, supporting roles and fine-grained permissions.
- **Auth Endpoint**: Live `/api/v1/auth/login` endpoint for secure token exchange.

### 🚀 Bootstrapping
- **DataInitializer**: On startup, the system automatically seeds:
    - Default **Admin** user.
    - **Production** environment.
    - Default **Infra Agent** application.

## 3. Technical Specs
- **Database**: JPA / Hibernate with MySQL 8 Dialect.
- **Security**: Stateless Filter Chain with `OncePerRequestFilter`.
- **Logging**: SLF4J / Logback.

## 4. How to Verify
1. **Build**: `mvn clean compile` (Confirmed SUCCESS).
2. **Launch**: `mvn spring-boot:run`.
3. **Database**: Check MySQL to see all 10 tables automatically generated.
4. **Login**: POST to `/api/v1/auth/login` with `{"username": "admin", "password": "admin123"}`.

