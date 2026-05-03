# 🚀 Application Monitoring Features

Monetique Eye provides a comprehensive, multi-stack observability platform designed to monitor, manage, and scale applications across diverse environments.

## 🛠️ Onboarding Flows

Monetique Eye supports two distinct paths for bringing applications under management:

### 1. Automatic Deployment (GitOps)
Perfect for new services or those requiring automated lifecycle management.
- **Repository Analysis**: Simply provide a GitHub URL; the system automatically detects frameworks (Spring Boot, Node.js, Python, etc.) and project structures.
- **Automated CI/CD**: Builds Docker images, generates Nginx configurations, and deploys to the target node using Ansible-driven GitOps.
- **Auto-Config**: Automatically generates Dockerfiles and deployment manifests if they are missing from the source code.

### 2. Manual Onboarding (Direct Registration)
Designed for legacy services or applications already running on your infrastructure.
- **Lightning Registration**: Register an existing service in seconds without modifying its deployment pipeline.
- **Connectivity Verification**: The system performs a real-time "ping" via SSH using `docker ps`, `netstat`, or `ss` to verify the application is healthy and reachable before adding it to the dashboard.
- **No-Env Skip**: Streamlined flow that skips complex configuration for services that only require monitoring.

---

## 📊 Observability Stack

### 📈 Metrics & Performance
- **Golden Signals Monitoring**: Tracks Request Rate, Error Rate, and Latency (RED metrics) for every application.
- **Prometheus Integration**: Automated service discovery. Once an application is registered, the system configures Prometheus to scrape its metrics endpoints.
- **Framework Support**: Deep integration with Spring Boot Actuator, Django Prometheus, and Node.js exporters.

### 📜 Centralized Logging
- **Elastic Stack (ELK)**: 
    - **Filebeat**: Harvests container logs directly from agent nodes.
    - **Logstash**: Enriches logs with metadata (Environment, Node, Application ID, Severity).
    - **Elasticsearch**: High-performance indexing for rapid search.
- **Environment-Aware Logs**: Filter logs across multiple clusters and environments (Production, Pre-Prod, QA) from a single unified view.

### 🏗️ Infrastructure Context
- **Node Correlation**: Every application is tied to its host node. Monitor CPU, Memory, and Disk usage of the underlying infrastructure in the same dashboard as your app metrics.
- **Topology Mapping**: Visualize how applications are distributed across your nodes and environments.

---

## 🚀 Advanced Deployment Features

- **Canary Releases**: Deploy new versions to a subset of traffic and promote them to stable only after validating health metrics.
- **Environment Cascading**: Seamlessly switch between global environments to see localized telemetry and status.
- **Real-time Activity Logs**: Every deployment, restart, and configuration change is audited and visible in the system-wide pulse feed.
