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


# 6. Setup Directory Structure
echo "🔹 Configuring /opt/monetique permissions..."
if [ -d "/data/monetique" ]; then
    echo "⚠️ Found legacy /data/monetique directory. Please migrate data manually if needed."
fi
mkdir -p /opt/monetique/apps
chown -R monitoring:monitoring /opt/monetique
chmod -R 755 /opt/monetique

# 7. Final Check
echo "---------------------------------------------------"
echo "✅ Node Preparation Complete!"
echo "---------------------------------------------------"
echo "Next steps:"
echo "1. Log into Monetique-Eye Dashboard."
echo "2. Add this node using the IP: $(hostname -I | awk '{print $1}')"
echo "3. Use the 'monitoring' user credentials."
echo "---------------------------------------------------"
