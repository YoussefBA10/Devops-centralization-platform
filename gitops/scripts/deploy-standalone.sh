#!/bin/bash
# =============================================================================
# Deploy Node Exporter Standalone via Raw SSH (No Python/Ansible on remote!)
# =============================================================================
# Usage: deploy-standalone.sh <ssh_user> <target_ip> <image_cache_dir> <env_label> <nodename>
#
# This script deploys Node Exporter as a systemd user service using only
# SSH and SCP. It requires ZERO dependencies on the remote host — no Python,
# no Docker, no package manager. Only bash and systemd are needed.
# =============================================================================

set -e

SSH_USER="$1"
TARGET_IP="$2"
IMAGE_CACHE_DIR="$3"
ENV_LABEL="$4"
NODENAME="$5"

if [ -z "$SSH_USER" ] || [ -z "$TARGET_IP" ]; then
    echo "ERROR: Usage: deploy-standalone.sh <ssh_user> <target_ip> <image_cache_dir> [env_label] [nodename]"
    exit 1
fi

IMAGE_CACHE_DIR="${IMAGE_CACHE_DIR:-/app/gitops/image-cache}"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10"
TARBALL_NAME="node_exporter-1.7.0.linux-amd64.tar.gz"
TARBALL_PATH="${IMAGE_CACHE_DIR}/${TARBALL_NAME}"

echo "===================================================="
echo "  Monetique Eye: Standalone Node Exporter Deployment"
echo "===================================================="
echo "📍 Target: ${SSH_USER}@${TARGET_IP}"
echo "📍 Mode:   Raw SSH (No Python required on remote)"

# ─────────────────────────────────────────────
# 1. Ensure Node Exporter binary is cached locally
# ─────────────────────────────────────────────
echo ""
echo "🔹 Step 1: Checking local binary cache..."
mkdir -p "$IMAGE_CACHE_DIR"

if [ -f "$TARBALL_PATH" ]; then
    echo "✅ Node Exporter tarball already cached at: ${TARBALL_PATH}"
else
    echo "📦 Downloading Node Exporter v1.7.0..."
    if command -v curl &> /dev/null; then
        curl -sL -o "$TARBALL_PATH" \
            "https://github.com/prometheus/node_exporter/releases/download/v1.7.0/${TARBALL_NAME}"
    elif command -v wget &> /dev/null; then
        wget -q -O "$TARBALL_PATH" \
            "https://github.com/prometheus/node_exporter/releases/download/v1.7.0/${TARBALL_NAME}"
    else
        echo "ERROR: Neither wget nor curl found on controller. Cannot download binary."
        exit 1
    fi
    echo "✅ Downloaded successfully."
fi

# ─────────────────────────────────────────────
# 2. Verify SSH connectivity
# ─────────────────────────────────────────────
echo ""
echo "🔹 Step 2: Verifying SSH connectivity..."
if ssh $SSH_OPTS "${SSH_USER}@${TARGET_IP}" "echo 'SSH_OK'" 2>/dev/null | grep -q "SSH_OK"; then
    echo "✅ SSH connection verified."
else
    echo "ERROR: Cannot connect to ${SSH_USER}@${TARGET_IP} via SSH."
    exit 1
fi

# ─────────────────────────────────────────────
# 3. Check if Node Exporter is already running
# ─────────────────────────────────────────────
echo ""
echo "🔹 Step 3: Checking for existing Node Exporter..."
EXISTING=$(ssh $SSH_OPTS "${SSH_USER}@${TARGET_IP}" "pgrep -x node_exporter > /dev/null 2>&1 && echo 'RUNNING' || echo 'NOT_RUNNING'" 2>/dev/null)

if [ "$EXISTING" = "RUNNING" ]; then
    echo "✅ Node Exporter is already running on ${TARGET_IP}. Skipping deployment."
    echo "FINAL_NODE_EXPORTER_PORT=9100"
    exit 0
fi

# ─────────────────────────────────────────────
# 4. Create directories on remote
# ─────────────────────────────────────────────
echo ""
echo "🔹 Step 4: Creating directories on remote host..."
ssh $SSH_OPTS "${SSH_USER}@${TARGET_IP}" "mkdir -p ~/node-exporter ~/.config/systemd/user" 2>/dev/null
echo "✅ Directories created."

# ─────────────────────────────────────────────
# 5. Transfer tarball to remote via SCP
# ─────────────────────────────────────────────
echo ""
echo "🔹 Step 5: Transferring Node Exporter binary to remote..."
scp $SSH_OPTS "$TARBALL_PATH" "${SSH_USER}@${TARGET_IP}:~/node_exporter.tar.gz" 2>/dev/null
echo "✅ Binary transferred."

# ─────────────────────────────────────────────
# 6. Extract binary on remote
# ─────────────────────────────────────────────
echo ""
echo "🔹 Step 6: Extracting Node Exporter on remote..."
ssh $SSH_OPTS "${SSH_USER}@${TARGET_IP}" "tar -xzf ~/node_exporter.tar.gz -C ~/node-exporter --strip-components=1 && rm -f ~/node_exporter.tar.gz" 2>/dev/null
echo "✅ Binary extracted to ~/node-exporter/"

# ─────────────────────────────────────────────
# 7. Create systemd user service file
# ─────────────────────────────────────────────
echo ""
echo "🔹 Step 7: Writing systemd service file..."
ssh $SSH_OPTS "${SSH_USER}@${TARGET_IP}" "cat > ~/.config/systemd/user/node-exporter.service << 'SERVICEEOF'
[Unit]
Description=Node Exporter Standalone Service (Monetique Eye)
After=network.target

[Service]
Type=simple
ExecStart=%h/node-exporter/node_exporter --collector.systemd
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
SERVICEEOF" 2>/dev/null
echo "✅ Service file created."

# ─────────────────────────────────────────────
# 8. Enable and start Node Exporter
# ─────────────────────────────────────────────
echo ""
echo "🔹 Step 8: Starting Node Exporter service..."

# Get the remote UID for XDG_RUNTIME_DIR
REMOTE_UID=$(ssh $SSH_OPTS "${SSH_USER}@${TARGET_IP}" "id -u" 2>/dev/null)

# Try systemd user service first (requires lingering + XDG_RUNTIME_DIR)
SYSTEMD_OK=$(ssh $SSH_OPTS "${SSH_USER}@${TARGET_IP}" "
    export XDG_RUNTIME_DIR=/run/user/${REMOTE_UID}
    export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/${REMOTE_UID}/bus
    systemctl --user daemon-reload 2>/dev/null && \
    systemctl --user enable node-exporter 2>/dev/null && \
    systemctl --user start node-exporter 2>/dev/null && \
    echo 'SYSTEMD_OK' || echo 'SYSTEMD_FAIL'
" 2>/dev/null)

if echo "$SYSTEMD_OK" | grep -q "SYSTEMD_OK"; then
    echo "✅ Node Exporter started via systemd user service."
else
    echo "⚠️  systemd --user not available. Starting with nohup fallback..."
    ssh $SSH_OPTS "${SSH_USER}@${TARGET_IP}" "
        # Kill any existing instance
        pkill -x node_exporter 2>/dev/null || true
        sleep 1
        # Start with nohup
        nohup ~/node-exporter/node_exporter --collector.systemd > ~/node-exporter/node_exporter.log 2>&1 &
        disown
    " 2>/dev/null
    echo "✅ Node Exporter started via nohup."
fi

# ─────────────────────────────────────────────
# 9. Verify the service is running
# ─────────────────────────────────────────────
echo ""
echo "🔹 Step 9: Verifying deployment..."
sleep 2
VERIFY=$(ssh $SSH_OPTS "${SSH_USER}@${TARGET_IP}" "pgrep -x node_exporter > /dev/null 2>&1 && echo 'active' || echo 'inactive'" 2>/dev/null)

if echo "$VERIFY" | grep -q "active"; then
    echo "✅ Node Exporter is running and healthy!"
else
    echo "⚠️  Service may not have started correctly. Checking process..."
    ssh $SSH_OPTS "${SSH_USER}@${TARGET_IP}" "ps aux | grep node_exporter | grep -v grep" 2>/dev/null || true
fi

# ─────────────────────────────────────────────
# Done!
# ─────────────────────────────────────────────
echo ""
echo "===================================================="
echo "  ✅ Standalone Deployment Complete!"
echo "===================================================="
echo "FINAL_NODE_EXPORTER_PORT=9100"
echo "📍 Node Exporter is serving metrics at: http://${TARGET_IP}:9100/metrics"
