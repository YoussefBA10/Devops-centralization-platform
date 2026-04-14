#!/bin/bash
# Monetique-Eye SSH Configuration Script
# Usage: ./ssh-configure.sh [USER] [AGENT_IP]

USER=$1
AGENT_IP=$2
PASSWORD=$3

if [ -z "$USER" ] || [ -z "$AGENT_IP" ]; then
    echo "ERROR: Missing parameters. Usage: ./ssh-configure.sh [USER] [AGENT_IP] [PASSWORD]"
    exit 1
fi

echo "--- Initializing SSH configuration for $USER@$AGENT_IP ---"

# Ensure local SSH key exists
if [ ! -f ~/.ssh/id_rsa ]; then
    echo "Generating new SSH key pair..."
    ssh-keygen -t rsa -b 4096 -N "" -f ~/.ssh/id_rsa
fi

# Attempt to copy ID
echo "Copying public key to remote host..."

# We avoid strict host key checking for the initial setup to automate the flow
if [ -n "$PASSWORD" ]; then
    if ! command -v sshpass &> /dev/null; then
        echo "ERROR: sshpass is not installed. Please install it to use password automation."
        exit 1
    fi
    sshpass -p "$PASSWORD" ssh-copy-id -o StrictHostKeyChecking=no "$USER@$AGENT_IP"
else
    echo "Wait: No password provided. You may be prompted for the remote password interactively."
    ssh-copy-id -o StrictHostKeyChecking=no "$USER@$AGENT_IP"
fi

if [ $? -eq 0 ]; then
    echo "SUCCESS: Passwordless SSH established."
else
    echo "ERROR: Failed to copy SSH key. Please check target connectivity and credentials."
    exit 1
fi
