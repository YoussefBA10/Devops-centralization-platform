#!/bin/bash
# Monetique-Eye SSH Configuration Script
# Final Polish: Professional Error Handling & Logging

set -euo pipefail

# --- CONFIGURATION ---
LOG_FILE="/var/log/monetique-eye-deploy.log"
USER=$1
AGENT_IP=$2
PASSWORD=${3:-""}

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
    if [ $exit_code -ne 0 ]; then
        error "SSH configuration failed at step: $BASH_COMMAND"
        echo -e "${YELLOW}💡 TROUBLESHOOTING:${NC}"
        echo -e "   1. Verify the AGENT_IP ($AGENT_IP) is reachable via 'ping'."
        echo -e "   2. Ensure the firewall on the target allows port 22."
        echo -e "   3. If using a password, ensure 'sshpass' is installed."
        echo -e "   4. Check logs at: $LOG_FILE"
    fi
}
trap cleanup EXIT

# --- INITIALIZATION ---
echo -e "${BLUE}====================================================${NC}"
echo -e "  ${BLUE}Monetique Eye: Initializing SSH connectivity${NC}"
echo -e "${BLUE}====================================================${NC}"

if [ -z "$USER" ] || [ -z "$AGENT_IP" ]; then
    error "Missing parameters. Usage: ./ssh-configure.sh [USER] [AGENT_IP] [PASSWORD]"
    exit 1
fi

# Ensure log file exists and is writable
touch "$LOG_FILE" 2>/dev/null || { warn "Cannot write to $LOG_FILE. Logging to local directory instead."; LOG_FILE="./ssh-configure.log"; touch "$LOG_FILE"; }

info "Configuring SSH for $USER@$AGENT_IP..."

# Ensure local SSH key exists
if [ ! -f ~/.ssh/id_rsa ]; then
    info "Generating new 4096-bit RSA SSH key pair..."
    ssh-keygen -t rsa -b 4096 -N "" -f ~/.ssh/id_rsa
fi

# Check for sshpass if password is provided
if [ -n "$PASSWORD" ] && ! command -v sshpass &> /dev/null; then
    error "sshpass is required for password automation but is not installed."
    echo -e "${YELLOW}Fix:${NC}"
    echo -e "   - Debian/Ubuntu: ${BLUE}sudo apt-get install sshpass -y${NC}"
    echo -e "   - RHEL/CentOS:   ${BLUE}sudo dnf install sshpass -y${NC}"
    exit 1
fi

 # Copying public key
info "Copying public key toremote host (using -o StrictHostKeyChecking=no)..."

if [ -n "$PASSWORD" ]; then
    if ! sshpass -p "$PASSWORD" ssh-copy-id -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$USER@$AGENT_IP"; then
        error "Failed to copy SSH key using provided password."
        exit 1
    fi
else
    warn "No password provided. Interactive login may be required."
    if ! ssh-copy-id -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$USER@$AGENT_IP"; then
        error "Interactive SSH key copy failed."
        exit 1
    fi
fi

success "Passwordless SSH established for $USER@$AGENT_IP."
trap - EXIT
exit 0
