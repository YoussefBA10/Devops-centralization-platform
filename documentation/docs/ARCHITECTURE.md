# Monetique-Eye Architecture

## High-Level Overview

Monetique-Eye is a clean, enterprise-grade hosted observability platform.  
Clients run one Ansible script → Admin performs one-click deployment from UI → Full monitoring + ticket collaboration is live.

### Core Concepts
- **Environment**: Top-level container (Prod-ClientX, Staging-EU, etc.)
- **Application**: Hosted inside an Environment
- **Automated Deployment**: Backend executes your GitOps Ansible playbooks
- **RBAC**: Strict ADMIN / USER with Environment-level isolation

## Technology Stack (Simplified)

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | React 18 + Vite + Tailwind + React Flow |
| Backend     | Spring Boot 3.3 + Java 17 + JPA     |
| Database    | MySQL 8.0                           |
| Logs        | Elasticsearch + Logstash + Filebeat |
| Metrics     | Prometheus + cAdvisor + Node Exporter |
| AI          | Groq Llama 3.3 70B                  |
| Deployment  | Your existing GitOps Ansible scripts |

## Data Flow (One-Click Deployment)

1. Admin clicks "Deploy New Environment" in UI
2. Backend runs `ssh-configure.sh` + generates inventory
3. Ansible deploys monitoring tools on client nodes
4. Nodes register in Prometheus
5. Backend auto-creates Environment + Application records
6. Monitoring and Tickets become immediately available

---

[Next: PROJECT_STRUCTURE.md](../../PROJECT_STRUCTURE.md) | [Diagrams](./DIAGRAMS.md)
