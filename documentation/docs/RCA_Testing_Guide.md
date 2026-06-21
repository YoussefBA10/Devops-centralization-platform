# Root Cause Analysis (RCA) Testing Guide

This guide details how to safely simulate the conditions for the 6 new Root Cause Intelligence categories in a local or development environment to validate the detection engine.

> [!WARNING]
> Ensure you are running these tests in a non-production, development environment. While these tests do not contain destructive payloads, they intentionally simulate service degradation.

## 1. DATABASE_CONNECTION_FAILURE

**Description**: Detects when the application cannot communicate with its database due to network issues, pool exhaustion, or invalid credentials.

**How to Simulate Safely**:
- Stop the local database container: `docker stop monetique-postgres` (or your DB container name).
- Trigger any application endpoint that requires database access (e.g., `curl http://localhost:8880/api/v1/users`).

**Expected Logs**:
```
ERROR: HikariPool - Connection is not available
ERROR: Cannot acquire connection from pool
```

**Expected RCA Result**:
```json
{
  "rootCause": "DATABASE_CONNECTION_FAILURE",
  "confidence": "high",
  "evidence": [
    "HikariPool - Connection is not available",
    "Cannot acquire connection from pool"
  ]
}
```

## 2. DEPLOYMENT_FAILURE

**Description**: Identifies when a recent deployment introduces breaking changes causing the application to repeatedly crash or fail to start.

**How to Simulate Safely**:
- If running in Kubernetes locally (minikube/kind), update the deployment to use a non-existent image tag (e.g., `monetique-backend:invalid-tag`).
- Alternatively, modify the application entrypoint command in Docker to intentionally fail (`exit 1`).

**Expected Logs**:
```
CrashLoopBackOff
Container restarted repeatedly
```

**Expected RCA Result**:
```json
{
  "rootCause": "DEPLOYMENT_FAILURE",
  "confidence": "high",
  "evidence": [
    "Kubernetes CrashLoopBackOff detected"
  ]
}
```

## 3. CONFIGURATION_ERROR

**Description**: Identifies application failures resulting from missing or malformed configuration values (e.g., secrets, YAML formatting).

**How to Simulate Safely**:
- Remove a required environment variable from the `.env` file or `docker-compose.yml` (e.g., `JWT_SECRET`).
- Restart the application service.

**Expected Logs**:
```
Could not resolve placeholder 'JWT_SECRET' in value "${JWT_SECRET}"
Application context initialization failed
```

**Expected RCA Result**:
```json
{
  "rootCause": "CONFIGURATION_ERROR",
  "confidence": "high",
  "evidence": [
    "Could not resolve placeholder (Missing environment variable)"
  ]
}
```

## 4. NETWORK_FAILURE

**Description**: Detects generalized network reachability issues such as DNS resolution failures or routing timeouts.

**How to Simulate Safely**:
- Change an external API integration URL in the application properties to an unresolvable hostname (e.g., `http://invalid.internal.service.local`).
- Trigger the application flow that calls this external service.

**Expected Logs**:
```
Failed to resolve hostname
Connection timeout
```

**Expected RCA Result**:
```json
{
  "rootCause": "NETWORK_FAILURE",
  "confidence": "high",
  "evidence": [
    "Failed to resolve hostname",
    "Connection timeout"
  ]
}
```

## 5. DEPENDENCY_FAILURE

**Description**: Specifically targets known critical external dependencies like Redis, Kafka, or Elasticsearch.

**How to Simulate Safely**:
- Stop the specific dependency container, e.g., `docker stop monetique-redis`.
- Trigger an application flow that relies on caching or messaging.

**Expected Logs**:
```
Unable to connect to redis:6379
```

**Expected RCA Result**:
```json
{
  "rootCause": "DEPENDENCY_FAILURE",
  "confidence": "high",
  "evidence": [
    "Redis connection failed",
    "Application errors increased"
  ]
}
```

## 6. TRAFFIC_SPIKE

**Description**: Identifies service degradation caused purely by an abnormal influx of traffic, leading to 429 Too Many Requests or severe latency spikes.

**How to Simulate Safely**:
- Use a load testing tool like Apache Bench (`ab`) or `hey` to send a burst of requests to a non-destructive, read-only endpoint.
- Alternatively, if you have an API Gateway rate limiter configured, trigger it intentionally.

**Command Example**:
```bash
# Send 2000 requests with 50 concurrent workers
hey -n 2000 -c 50 http://localhost:8880/api/v1/health
```

**Expected Logs / Metrics**:
- Gateway logs returning HTTP 429.
- Prometheus `http_server_requests_seconds_count` spiking significantly compared to the historical baseline.

**Expected RCA Result**:
```json
{
  "rootCause": "TRAFFIC_SPIKE",
  "confidence": "medium",
  "evidence": [
    "HTTP 429 (Too Many Requests) returned by gateway",
    "Requests per second increased suddenly (>2x vs 1h ago)"
  ]
}
```
