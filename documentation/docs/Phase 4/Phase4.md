# Phase 4: Frontend Dashboard & UI Integration

**Monetique-Eye Observability Platform**  
**Status**: Planning & Implementation  
**Environment**: React 18 + Vite + TypeScript + Tailwind CSS

## 1. Phase 3 Fixes Applied

- All APIs tested and validated (Authentication, Deployment, Tickets, Operational, Logs, Topology).
- RBAC enforcement confirmed (ADMIN vs USER environment isolation).
- GitOps/Ansible deployment working end-to-end.
- Stability scoring and AI digest endpoints returning correct data.
- No critical bugs remain — platform is stable at the backend level.

## 2. Phase 4 Objectives

Build a clean, executive-grade React frontend with dark theme that consumes all backend APIs and provides a beautiful, functional user experience.

**Core Principles**:
- Only **7 pages** (keep it simple and focused)
- Strict Environment scoping for USER role
- Modern, premium dark UI (Tailwind + Lucide icons)
- Real-time feel with auto-refresh where appropriate
- Full integration with existing backend APIs

## 3. Frontend Structure
frontend/
├── src/
│   ├── pages/                          # Only 7 pages
│   │   ├── EnvironmentsPage.tsx        # ADMIN only - list + deploy buttons
│   │   ├── DashboardPage.tsx
│   │   ├── OperationalIntelligence.tsx # Stability + AI Digest + Heatmap
│   │   ├── LogsPage.tsx
│   │   ├── InfrastructureTopologyPage.tsx
│   │   ├── TicketsPage.tsx
│   │   └── ChatPage.tsx                # AI Assistant
│   ├── components/
│   │   ├── layout/                     # Sidebar, Header, ApplicationSelector
│   │   ├── deployment/                 # DeployForm, DeploymentStatus
│   │   ├── ui/                         # Reusable buttons, cards, modals
│   │   └── operational/                # StabilityCard, RiskHeatmap, etc.
│   ├── context/
│   │   ├── AuthContext.tsx             # JWT + role + assigned environments
│   │   └── EnvironmentContext.tsx      # Current selected environment
│   ├── services/                       # API service layer (axios)
│   └── types/                          # TypeScript interfaces
text## 4. Key Pages & Features

### 4.1 EnvironmentsPage.tsx (ADMIN only)
- List of all Environments with status and last deployment time
- "Deploy New Environment" button → opens form (targetIp, sshUser)
- "Deploy Application" button per environment
- Real-time deployment status (progress + logs)

### 4.2 DashboardPage.tsx
- Global overview cards (Active Environments, Total Nodes, Open Tickets, Stability Average)
- Quick links to Operational Intelligence and Tickets

### 4.3 OperationalIntelligence.tsx (Main Executive Page)
- Stability Index radial gauge (Z-Score)
- AI Executive Digest card (from Groq)
- Service Risk Heatmap table
- Log Drift chart
- Recurring Issues panel
- Active Incidents summary

### 4.4 InfrastructureTopologyPage.tsx
- Interactive React Flow topology with custom ServerCard nodes
- Live metrics (CPU, RAM, Containers) from deployed agents

### 4.5 TicketsPage.tsx
- Ticket list with filters (Environment, Status)
- Create new ticket (select Environment + optional Application)
- Status update (Open → In Progress → Resolved)

### 4.6 LogsPage.tsx
- Full-text search with filters
- Log table with severity and category badges

### 4.7 ChatPage.tsx
- AI DevOps Assistant (Groq Llama 3.3)
- Persistent chat history
- 3D particle background (optional premium touch)

## 5. Authentication & Role Handling

- **AuthContext.tsx**: Stores token, user role, and list of assigned environments
- **ProtectedRoute**: Redirects unauthenticated users to login
- **Role-based UI**:
  - ADMIN → sees Environments management + deploy buttons
  - USER → sees only assigned environments, no deploy buttons, simplified header

## 6. API Service Layer

Create `services/api.ts` with axios instance that automatically adds Bearer token and handles 401/403 errors.

Example calls:
- `getEnvironments()`
- `deployAgent(environmentId, payload)`
- `getStability(environmentId)`
- `getTickets(environmentId)`

## 7. Implementation Order (Recommended)

1. Setup Vite + React + TypeScript + Tailwind + Lucide React + React Flow + Recharts + Axios
2. Implement `AuthContext.tsx` and login page
3. Create layout (Sidebar + Header)
4. Build `EnvironmentsPage.tsx` with deploy forms (highest priority)
5. Implement `OperationalIntelligence.tsx` (main value page)
6. Add remaining pages (Topology, Tickets, Logs, Chat)
7. Add auto-refresh logic (useEffect + setInterval) for live data

## 8. Verification Plan

- Login as ADMIN → Create/Deploy Environment → See nodes in Topology
- Login as USER → Only see assigned environments → Cannot deploy
- Operational page shows real Stability Index and AI Digest
- Create ticket → status updates work
- Chat assistant responds with environment-scoped context