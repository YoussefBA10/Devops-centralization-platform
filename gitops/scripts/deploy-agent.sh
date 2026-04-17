#!/bin/bash
# Monetique-Eye Agent Deployment Wrapper
# Final Polish: Professional Error Handling & Logging

set -euo pipefail

# --- CONFIGURATION ---
LOG_FILE="/var/log/monetique-eye-deploy.log"
ENV_LABEL=$1
AGENT_IP=$2
USER=${3:-root}
PASSWORD=${4:-""}

# --- COLORS ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# --- LOGGING FUNCTIONS ---
log() {
    local level=$1
    local msg=$2
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    echo -e "${timestamp} [${level}] ${msg}" | tee -a "$LOG_FILE" > /dev/null
}

info() { echo -e "${BLUE}📍 [INFO]${NC} $1"; log "INFO" "$1"; }
success() { echo -e "${GREEN}✅ [SUCCESS]${NC} $1"; log "SUCCESS" "$1"; }
warn() { echo -e "${YELLOW}⚠️  [WARN]${NC} $1"; log "WARN" "$1"; }
error() { echo -e "${RED}❌ [ERROR]${NC} $1"; log "ERROR" "$1"; }

# --- ERROR HANDLER ---
cleanup() {
    local exit_code=$?
    # Ensure temp inventory is removed
    if [ -f "$INVENTORY" ]; then
        rm "$INVENTORY"
    fi

    if [ $exit_code -ne 0 ]; then
        error "Deployment failed for environment: $ENV_LABEL ($AGENT_IP)"
        echo -e "${YELLOW}💡 TROUBLESHOOTING:${NC}"
        echo -e "   1. If SSH failed, try running: ${BLUE}./scripts/ssh-configure.sh $USER $AGENT_IP${NC}"
        echo -e "   2. If Ansible failed, run the playbook with ${BLUE}-vvv${NC} for more details:"
        echo -e "      ansible-playbook -i c:/Users/youss/OneDrive/Documents/Work/monetique-eye/gitops/ansible/inventory.ini c:/Users/youss/OneDrive/Documents/Work/monetique-eye/gitops/ansible/deploy-tools.yml --limit $AGENT_IP -vvv"
        echo -e "   3. Check detailed transition logs at: $LOG_FILE"
    fi
}
trap cleanup EXIT

# --- INITIALIZATION ---
echo -e "${BLUE}====================================================${NC}"
echo -e "  ${BLUE}Monetique Eye: Starting Agent Deployment${NC}"
echo -e "  Env: $ENV_LABEL | Target: $AGENT_IP"
echo -e "${BLUE}====================================================${NC}"

if [ -z "$ENV_LABEL" ] || [ -z "$AGENT_IP" ]; then
    error "Missing parameters. Usage: ./deploy-agent.sh [ENV_LABEL] [AGENT_IP] [USER] [PASSWORD]"
    exit 1
fi

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
GITOPS_ROOT="$DIR/.."
INVENTORY="$GITOPS_ROOT/ansible/inventory_tmp_$AGENT_IP.ini"

# Ensure log file exists
touch "$LOG_FILE" 2>/dev/null || { warn "Cannot write to $LOG_FILE. Logging locally."; LOG_FILE="./deploy.log"; touch "$LOG_FILE"; }

# 1. SSH Configuration
info "Phase 1: Ensuring SSH connectivity..."
if ! "$GITOPS_ROOT/scripts/ssh-configure.sh" "$USER" "$AGENT_IP" "$PASSWORD"; then
    error "SSH Phase Failed. Actions required above."
    exit 1
fi

# 2. Generate temporary inventory for isolation
info "Phase 2: Preparing isolated Ansible inventory..."
echo "[agents]" > "$INVENTORY"
echo "node-agent ansible_host=$AGENT_IP ansible_user=$USER" >> "$INVENTORY"

# 3. Run Ansible Playbook
info "Phase 3: Executing Ansible Playbook (deploy-tools.yml)..."
if ! ansible-playbook -i "$INVENTORY" "$GITOPS_ROOT/ansible/deploy-tools.yml" -e "env_label=$ENV_LABEL"; then
    error "Ansible Playbook execution failed."
    exit 1
fi

success "Agent deployment completed successfully for $ENV_LABEL."
trap - EXIT
exit 0
