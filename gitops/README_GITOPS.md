# Monetique-Eye GitOps Repository

This directory contains the automation and configuration management assets for the Monetique-Eye platform.

## Directory Structure

- `vmpipe/`: Central node orchestration (Prometheus, Logstash, ELK, etc.).
- `scripts/`: Operational scripts for node maintenance and agent deployment.
- `ansible/`: Configuration management playbooks.
- `agents/`: Template configurations for edge nodes.

## Usage

### 1. SSH Setup
Run the `ssh-configure.sh` script to set up passwordless access to a new agent node:
```bash
./scripts/ssh-configure.sh root 192.168.1.50
```

### 2. Manual Deployment
To manually apply the observability stack to a node:
```bash
./scripts/deploy-agent.sh test-env 192.168.1.50 root
```

## Security Note
All sensitive variables (passwords, tokens) should be managed via environment variables and NOT committed to this repository directly.
