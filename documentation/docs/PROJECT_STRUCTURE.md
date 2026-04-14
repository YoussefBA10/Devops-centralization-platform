# Monetique-Eye Project Structure

> **Last Updated**: April 2026  
> Clean, simplified, environment-first observability platform

## Root Directory Structure
monetique-eye/
├── backend/                          # Spring Boot 3.3 Backend
│   ├── src/
│   │   └── main/
│   │       ├── java/com/monetique/eye/
│   │       │   ├── entity/           # 10 entities only
│   │       │   ├── repository/
│   │       │   ├── service/          # DeploymentService, EnvironmentService, etc.
│   │       │   ├── controller/
│   │       │   ├── config/
│   │       │   ├── scheduler/
│   │       │   └── util/
│   │       └── resources/
│   │           ├── application.yml
│   │           └── ansible/          # Symlink or copy of GitOps ansible folder
│   ├── pom.xml
│   └── Dockerfile
│
├── frontend/                         # React 18 + Vite + Tailwind
│   ├── src/
│   │   ├── pages/                    # Only 7 pages
│   │   │   ├── EnvironmentsPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── OperationalIntelligence.tsx
│   │   │   ├── LogsPage.tsx
│   │   │   ├── InfrastructureTopologyPage.tsx
│   │   │   ├── TicketsPage.tsx
│   │   │   └── ChatPage.tsx
│   │   ├── components/
│   │   ├── context/
│   │   ├── services/
│   │   └── types/
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
│
├── gitops/                           # Your existing GitOps repository (full copy)
│   ├── vmpipe/
│   ├── scripts/                      # ssh-configure.sh, deploy-agent.sh, etc.
│   ├── ansible/                      # deploy-tools.yml, inventory.ini, etc.
│   └── docker-volumes/
│
├── docker/                           # Docker Compose stack
│   ├── docker-compose.yml
│   └── .env
│
├── docs/                             # Documentation
│   ├── ARCHITECTURE.md
│   ├── DIAGRAMS.md
│   ├── DEPLOYMENT_GUIDE.md
│   └── TECHNICAL_DOCUMENTATION.md
│
├── README.md
└── .gitignore

**Key Principles**
- Only 10 backend entities
- Only 7 frontend pages
- Full reuse of your existing GitOps repo (no duplication)
- Environment-first design with automated deployment
