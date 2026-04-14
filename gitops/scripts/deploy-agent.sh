#!/bin/bash
# Monetique-Eye Agent Deployment Wrapper
# Usage: ./deploy-agent.sh [ENV_LABEL] [AGENT_IP] [USER]

ENV_LABEL=$1
AGENT_IP=$2
USER=${3:-root}
PASSWORD=$4

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
GITOPS_ROOT="$DIR/.."

echo "===================================================="
echo "  Monetique-Eye: Starting Agent Deployment"
echo "  Env: $ENV_LABEL | Target: $AGENT_IP"
echo "===================================================="

# 1. SSH Configuration
"$GITOPS_ROOT/scripts/ssh-configure.sh" "$USER" "$AGENT_IP" "$PASSWORD"
if [ $? -ne 0 ]; then
    echo "ERROR: SSH configuration failed."
    exit 1
fi

# 2. Generate temporary inventory
INVENTORY="$GITOPS_ROOT/ansible/inventory_tmp_$AGENT_IP.ini"
echo "[agents]" > "$INVENTORY"
echo "node-agent ansible_host=$AGENT_IP ansible_user=$USER" >> "$INVENTORY"

# 3. Run Ansible Playbook
echo "--- Running Ansible Playbook ---"
ansible-playbook -i "$INVENTORY" "$GITOPS_ROOT/ansible/deploy-tools.yml" \
    -e "env_label=$ENV_LABEL"

RESULT=$?

# Clean up
rm "$INVENTORY"

if [ $RESULT -eq 0 ]; then
    echo "SUCCESS: Agent deployed and metrics collection started."
else
    echo "ERROR: Ansible execution failed with exit code $RESULT"
    exit 1
fi
