# Phase 3: Real-time Observability Pipeline & Stability Engine

**Monetique-Eye Observability Platform**  
**Status**: Planning & Implementation  
**Environment**: JDK 21 LTS | Spring Boot 3.3 | MySQL 8.0

## 1. Phase 2 Fixes Applied

- **Scope Separation**: Phase 2 is now strictly limited to Security, RBAC, and GitOps/Ansible Integration. All observability logic moved to Phase 3.
- **Naming Consistency**: Standardized all API paths to `/api/` prefix (e.g., `/api/auth/login`, `/api/environments/{id}/deploy-agent`).
- **GitOps Integration Clarity**: Backend will mount the `gitops/` directory as a volume in Docker and use absolute paths for script execution.
- **Security Hardening**: Added explicit `@PreAuthorize` usage, CORS configuration, and JWT secret loading from `.env`.
- **Verification**: Provided cross-platform build and test commands.
- **Lombok & JDK**: Confirmed consistent use of Lombok with JDK 21.

## 2. Phase 3 Objectives

Build the real-time observability core: Prometheus metrics, Elasticsearch logs, Z-Score stability scoring, and Groq AI integration.

### Key Deliverables

#### 3.1 Observability Pipeline
- **Prometheus Integration**: `PrometheusClient.java` for PromQL queries (CPU, memory, container count, alerts)
- **Elasticsearch Integration**: `ElasticsearchLogService.java` for log search, trace grouping, and pattern detection
- **Logstash Configuration**: Reuse your existing `logstash.conf` from the GitOps repo for enrichment (category, severity, normalized summary)
- **Filebeat & cAdvisor**: Ensure agents deployed in Phase 2 correctly ship data to central services

#### 3.2 Stability Engine (Core Intelligence)
- **LogAggregationService.java**: Computes time-windowed metrics and Z-Score deviation
- **RecurringPatternService.java**: Fingerprinting (UUID/timestamp stripping) and trend analysis
- **OperationalScheduler.java**: Runs every 60 seconds to aggregate logs and calculate Stability Index (0-100)
- **IncidentDetection**: Auto-creates incidents from recurring patterns exceeding thresholds

#### 3.3 AI Integration
- **GroqService.java**: Low-level client for Llama 3.3 70B
- **AiDigestService.java**: Generates executive operational summaries
- **AiOperationalSummary** entity persistence

#### 3.4 Frontend Integration Points
- Update `OperationalIntelligence.tsx` to consume new stability and AI digest endpoints
- Add real-time refresh for topology and risk heatmap

## 3. Technical Specifications

- **Metrics**: PromQL queries filtered by `prometheusLabel` from Environment
- **Logs**: Elasticsearch indices scoped as `app-logs-{environment}-{date}`
- **Stability Scoring**: Z-Score model (penalize only > 3σ deviations)
- **Scheduler**: `@Scheduled` with fixed rate, guarded against overlapping runs
- **Error Resilience**: Circuit breaker pattern for external calls (Prometheus, Elasticsearch, Groq)

## 4. Implementation Order

1. Add dependencies: `spring-boot-starter-webflux` (for reactive Elasticsearch client if needed), Groq HTTP client
2. Implement `PrometheusClient.java` and `ElasticsearchLogService.java`
3. Create `LogAggregationService.java` + `RecurringPatternService.java`
4. Build `OperationalScheduler.java`
5. Implement `GroqService.java` + `AiDigestService.java`
6. Expose endpoints in `OperationalController.java` and `InfrastructureController.java`
7. Update frontend services to call new APIs

## 5. Verification Plan

- **Pipeline**: Deploy an agent → send test logs → verify they appear in `/logs` page with correct category/severity
- **Stability**: Trigger scheduler → check `LogAggregationWindow` table and Stability Index calculation
- **AI Digest**: Call AI endpoint → verify Groq response is stored in `AiOperationalSummary`
- **Topology**: Confirm nodes from deployed environments appear in React Flow with live metrics

**Cross-platform Build Command**:
```bash
./mvnw clean compile spring-boot:run

Next Phase: Phase 4 – Frontend Dashboard & UI Integration
Approval Required:
Please review this Phase 3 plan. Once confirmed, I will deliver the full code for:

PrometheusClient.java
ElasticsearchLogService.java
OperationalScheduler.java
GroqService.java