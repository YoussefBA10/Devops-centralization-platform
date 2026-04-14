# Walkthrough - Phase 5: GitOps & Infrastructure Automation

This document summarizes the implementation of the GitOps automation layer for the Monetique-Eye platform, enabling seamless, one-click provisioning of observability agents across distributed nodes.

## 1. Directory Structure & Documentation
The `gitops/` directory is now the central source of truth for all infrastructure-as-code and automation assets.

- **[README_GITOPS.md](file:///c:/Users/youss/OneDrive/Documents/Work/monetique-eye/gitops/README_GITOPS.md)**: Provides a comprehensive guide for developers and operators on how to use the automation scripts and playbooks.
- **`gitops/vmpipe/`**: Stores the central node's observability stack configuration.

## 2. Central Node Observability (vmpipe)
The [docker-compose.yml](file:///c:/Users/youss/OneDrive/Documents/Work/monetique-eye/gitops/vmpipe/docker-compose.yml) in `vmpipe` has been upgraded to a full-stack monitoring solution:
- **Relational Data**: MySQL 8.0 for platform state.
- **Metrics Engine**: Prometheus with Alertmanager, Blackbox, and Node exporters.
- **Logging Pipeline**: ELK Stack (Elasticsearch, Logstash, Filebeat) for centralized telemetry indexing.
- **Visualization**: Grafana with pre-configured provisioning.

## 3. Orchestration Scripts
Three core scripts now handle the lifecycle of remote agent provisioning:

- **[ssh-configure.sh](file:///c:/Users/youss/OneDrive/Documents/Work/monetique-eye/gitops/scripts/ssh-configure.sh)**: 
    - Automates SSH key distribution.
    - Uses `sshpass` for non-interactive password handling (optional).
    - Automatically initializes local keys if missing.
- **[deploy-agent.sh](file:///c:/Users/youss/OneDrive/Documents/Work/monetique-eye/gitops/scripts/deploy-agent.sh)**: 
    - The high-level wrapper used by the backend.
    - Orchestrates SSH setup, dynamic inventory generation, and Ansible execution.

## 4. Ansible Configuration Management
The [deploy-tools.yml](file:///c:/Users/youss/OneDrive/Documents/Work/monetique-eye/gitops/ansible/deploy-tools.yml) playbook ensures that every remote node is standard and observable:
- **Node Exporter**: Exposes system-level metrics (CPU, RAM, Disk).
- **cAdvisor**: Exposes container-level performance data.
- **Filebeat**: Harvests logs from Docker containers and ships them to the central Logstash.
- **Service Discovery**: Adds environment labels used by Prometheus for dynamic target identification.

## 5. Backend Service Integration
The Spring Boot **`DeploymentService`** is now fully synced with the GitOps repository:
- **Secure Process Execution**: Uses robust command handling to interact with the shell scripts.
- **Full Audit Trail**: Every deployment action logs its STDOUT and STDERR directly to the `DeploymentLog` table in the database.
- **Automatic Permission Management**: The service ensures all GitOps scripts are executable before running them.

---

### Verification Checklist
- **[x] GitOps Asset Integrity**: All scripts and playbooks are present and validated.
- **[x] Backend Linkage**: Deployment logic successfully invokes the new script paths.
- **[x] Stack Configuration**: Central stack defined with all required dependencies.
