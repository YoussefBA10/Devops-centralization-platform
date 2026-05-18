#!/bin/bash

# =================================================================
# Monetique-Eye V2.0.0 Standalone Node Preparation Script
# -----------------------------------------------------------------
# This script must be run as ROOT on any new server before
# adding it to the Monetique-Eye platform as a standalone node.
#
# It performs:
# 1. User creation (monitoring)
# 2. Enabling systemd lingering
# 3. Setting up systemd user directories
# =================================================================

set -e

echo "🚀 Starting Standalone Node Preparation..."

# 1. Detect OS
if [ -f /etc/redhat-release ]; then
    OS="RedHat"
    PKG_MGR="dnf"
elif [ -f /etc/lsb-release ] || [ -f /etc/debian_version ]; then
    OS="Debian"
    PKG_MGR="apt"
else
    echo "❌ Unsupported OS. Please create the monitoring user manually."
    exit 1
fi

echo "📦 Detected OS: $OS"

# 1.5. Ensure a compatible Python interpreter is installed (Required by Ansible)
HAS_COMPATIBLE_PYTHON=false

if command -v python3 &> /dev/null; then
    echo "✅ Found python3 interpreter."
    HAS_COMPATIBLE_PYTHON=true
elif command -v python &> /dev/null; then
    PY_VERSION=$(python -V 2>&1 | awk '{print $2}')
    echo "🔹 Found 'python' command with version: $PY_VERSION"
    if [[ "$PY_VERSION" =~ ^2\.[67] ]] || [[ "$PY_VERSION" =~ ^3\. ]]; then
        echo "✅ Pre-installed 'python' ($PY_VERSION) is compatible with Ansible."
        HAS_COMPATIBLE_PYTHON=true
    fi
fi

if [ "$HAS_COMPATIBLE_PYTHON" = false ]; then
    echo "🔹 Installing Python 3..."
    if [ "$OS" == "RedHat" ]; then
        $PKG_MGR install -y python3
    else
        $PKG_MGR update -y
        $PKG_MGR install -y python3
    fi
    echo "✅ Python 3 installed successfully."
fi

# 2. Create Monitoring User
if id "monitoring" &>/dev/null; then
    echo "✅ User 'monitoring' already exists."
else
    echo "🔹 Creating 'monitoring' user..."
    useradd -m -s /bin/bash monitoring
    echo "Please set a password for the 'monitoring' user:"
    passwd monitoring
fi

# 3. Enable systemd lingering
echo "🔹 Enabling systemd lingering for monitoring user..."
loginctl enable-linger monitoring || true

# 4. Setup systemd user config directory
echo "🔹 Creating user systemd directories..."
mkdir -p /home/monitoring/.config/systemd/user
chown -R monitoring:monitoring /home/monitoring/.config/systemd
chmod -R 755 /home/monitoring/.config/systemd

# 4.5. Setup Directory Structure
echo "🔹 Configuring /data/monetique permissions..."
if [ -d "/opt/monetique" ]; then
    echo "⚠️ Found legacy /opt/monetique directory. Please migrate data manually if needed."
fi
mkdir -p /data/monetique/apps
chown -R monitoring:monitoring /data/monetique
chmod -R 755 /data/monetique

# 5. Final Check
echo "---------------------------------------------------"
echo "✅ Standalone Node Preparation Complete!"
echo "---------------------------------------------------"
echo "Next steps:"
echo "1. Log into Monetique-Eye Dashboard."
echo "2. Add this node using the IP: $(hostname -I | awk '{print $1}')"
echo "3. Choose 'Standalone Service' in the deployment modal."
echo "4. Use the 'monitoring' user credentials."
echo "---------------------------------------------------"
