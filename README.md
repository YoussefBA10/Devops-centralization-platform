# ![Monetique Eye](monetique_eye_logo_1777723944582.png)

# Monetique Eye - Enterprise Observability Platform

> **Status**: Production Ready | **Version**: 1.0.0 | **Author**: Monetique Team

Monetique-Eye is a clean, enterprise-grade hosted observability platform designed for seamless infrastructure monitoring and automated deployment. It bridges the gap between complex GitOps workflows and intuitive administrative control.

---

## 🚀 The Vision

Our mission is to simplify infrastructure management:
**Clients run one Ansible script → Admin performs one-click deployment from UI → Full monitoring + ticket collaboration is live.**

---

## ✨ Key Features

- **🎯 Environment & Cluster Management**: Effortlessly toggle between multiple clusters and environments (Prod, Staging, Dev) with global scope persistence.
- **⚡ One-Click Deployment**: Fully automated SSH configuration and agent deployment via backend-orchestrated Ansible playbooks.
- **📊 Real-time Monitoring**: Integrated Prometheus metrics and Elasticsearch logging with a unified dashboard.
- **🤖 AI-Powered Insights**: Leveraging Groq Llama 3.3 for operational intelligence and automated log analysis.
- **🔐 Enterprise RBAC**: Role-based access control with Environment-level security.
- **🤝 Integrated Ticketing**: Built-in collaboration system linked directly to observability events.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, React Flow |
| **Backend** | Spring Boot 3.3, Java 17, Hibernate/JPA |
| **Database** | MySQL 8.0 |
| **Observability** | Prometheus, VictoriaMetrics, Grafana |
| **Log Management** | Elasticsearch, Logstash, Filebeat |
| **Orchestration** | Ansible, Docker, Shell Scripting |
| **AI Engine** | Groq Llama 3.3 (70B) |

---

## 🏗️ Architecture Overview

Monetique Eye operates on a "Push-Button" infrastructure model:

1.  **Global Selection**: Users can switch between Clusters and Environments at a global level to filter all platform data.
2.  **Orchestration**: The backend triggers `ssh-configure.sh` and generates dynamic inventories.
3.  **Provisioning**: Ansible playbooks deploy node exporters and logging agents on target nodes.
4.  **Ingestion**: Metrics flow to Prometheus; logs are streamed to the ELK stack.
5.  **Visualization**: The React frontend provides a consolidated view of health, topology, and logs.

---

## 📂 Project Structure

```text
monetique-eye/
├── 🖥️ backend/       # Spring Boot 3.3 API Service
├── 🎨 frontend/      # React 18 + Vite SPA
├── ⚙️ gitops/        # Ansible Playbooks, Prometheus Configs, & Scripts
├── 📄 documentation/ # Detailed Technical Guides & Diagrams
└── 🐳 docker/        # Centralized Docker Compose Deployment
```

---

## 🏁 Getting Started

### Prerequisites
- Docker & Docker Compose
- Java 17+
- Node.js 18+
- Ansible (on the host/backend runner)

### Quick Launch
1.  Clone the repository.
2.  Configure your environment variables in `.env`.
3.  Run the stack:
    ```bash
    docker-compose up -d
    ```

---

## 📖 Documentation

For more detailed information, please refer to:
- [Architecture Details](documentation/docs/ARCHITECTURE.md)
- [Project Structure](documentation/docs/PROJECT_STRUCTURE.md)
- [Deployment Guide](documentation/docs/07-operations-guide.md)

---

© 2026 Monetique Eye. All rights reserved.
