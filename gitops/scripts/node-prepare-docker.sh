#!/bin/bash

# =================================================================
# Monetique-Eye V2.0.0 Node Preparation Script
# -----------------------------------------------------------------
# This script must be run as ROOT on any new server before
# adding it to the Monetique-Eye platform.
#
# It performs:
# 1. User creation (monitoring)
# 2. Docker installation & group assignment
# 3. Directory structure & permissions setup
# =================================================================

set -e

echo "🚀 Starting Monetique-Eye Node Preparation..."

# 1. Detect OS
if [ -f /etc/redhat-release ]; then
    OS="RedHat"
    PKG_MGR="dnf"
elif [ -f /etc/lsb-release ] || [ -f /etc/debian_version ]; then
    OS="Debian"
    PKG_MGR="apt"
else
    echo "❌ Unsupported OS. Please install Docker and create the monitoring user manually."
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

# 2. Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "🔹 Installing Docker..."
    if [ "$OS" == "RedHat" ]; then
        $PKG_MGR install -y yum-utils
        yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
        $PKG_MGR install -y docker-ce docker-ce-cli containerd.io
    else
        $PKG_MGR update -y
        $PKG_MGR install -y docker.io
    fi
    systemctl enable --now docker
    echo "✅ Docker installed successfully."
else
    echo "✅ Docker is already installed."
fi

# 3. Install Git
if ! command -v git &> /dev/null; then
    echo "🔹 Installing Git..."
    $PKG_MGR install -y git
fi

# 4. Create Monitoring User
if id "monitoring" &>/dev/null; then
    echo "✅ User 'monitoring' already exists."
else
    echo "🔹 Creating 'monitoring' user..."
    useradd -m -s /bin/bash monitoring
    echo "Please set a password for the 'monitoring' user:"
    passwd monitoring
fi

# 5. Add to Docker group
echo "🔹 Assigning 'monitoring' to docker group..."
usermod -aG docker monitoring

# 5b. Enable systemd lingering
echo "🔹 Enabling systemd lingering for monitoring user..."
loginctl enable-linger monitoring || true



# 6. Setup Directory Structure
echo "🔹 Configuring /data/monetique permissions..."
if [ -d "/opt/monetique" ]; then
    echo "⚠️ Found legacy /opt/monetique directory. Please migrate data manually if needed."
fi
mkdir -p /data/monetique/apps
chown -R monitoring:monitoring /data/monetique
chmod -R 755 /data/monetique

# 7. Final Check
echo "---------------------------------------------------"
echo "✅ Node Preparation Complete!"
echo "---------------------------------------------------"
echo "Next steps:"
echo "1. Log into Monetique-Eye Dashboard."
echo "2. Add this node using the IP: $(hostname -I | awk '{print $1}')"
echo "3. Use the 'monitoring' user credentials."
echo "---------------------------------------------------"
