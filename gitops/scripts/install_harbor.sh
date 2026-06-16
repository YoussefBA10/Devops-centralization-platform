#!/bin/bash

# Define Harbor Version
HARBOR_VERSION="v2.10.0"
INSTALL_DIR="../harbor-setup"

echo "Downloading Harbor Offline Installer $HARBOR_VERSION..."
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

wget https://github.com/goharbor/harbor/releases/download/${HARBOR_VERSION}/harbor-offline-installer-${HARBOR_VERSION}.tgz
tar xzvf harbor-offline-installer-${HARBOR_VERSION}.tgz
cd harbor

echo "Configuring harbor.yml..."
cp harbor.yml.tmpl harbor.yml

# Replace hostname with harbor:80 or a specific domain
sed -i 's/hostname: reg.mydomain.com/hostname: harbor.monetique.local/g' harbor.yml

# Disable HTTPS for local testing (optional, comment out if you have certs)
sed -i 's/port: 80/port: 8083/g' harbor.yml
sed -i 's/https:/#https:/g' harbor.yml
sed -i 's/port: 443/#port: 443/g' harbor.yml
sed -i 's/certificate: \/your\/certificate\/path/#certificate: \/your\/certificate\/path/g' harbor.yml
sed -i 's/private_key: \/your\/private\/key\/path/#private_key: \/your\/private\/key\/path/g' harbor.yml

echo "Starting Harbor Installer..."
sudo ./install.sh

echo "Harbor is installed and running on port 8083!"
echo "Please add '127.0.0.1 harbor.monetique.local' to your /etc/hosts file."
