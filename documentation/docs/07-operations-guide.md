# 07 - Operations Guide

This guide provides operational instructions for managing the Monetique Eye observability platform.

## Deployment & Undeployment Troubleshooting

When a deployment or undeployment fails, the system provides colored terminal output and logs the failure to a central file. Use the table below to resolve common issues.

| Issue | Potential Reason | Actionable Fix / Next Step |
| :--- | :--- | :--- |
| **❌ SSH configuration failed** | Wrong credentials or IP unreachable. | Run `./scripts/ssh-configure.sh [USER] [IP]` to re-establish trust. |
| **❌ sshpass not installed** | Missing dependency on host machine. | Run `sudo apt-get install sshpass -y`. |
| **❌ Docker Check Failed** | Docker not installed or service down. | Run `sudo systemctl status docker` and `sudo systemctl restart docker`. |
| **❌ Ansible Playbook execution failed** | Network issue or playbook error. | Re-run with verbose logging: `ansible-playbook -i ... -vvv`. |
| **❌ Port 5045 refused** | Logstash/Central node firewall. | Verify central node IP and firewall rules. |
| **⚠️ Generic Task Failure** | Remote node resource exhaustion. | Check `htop` or `df -h` on the target agent node. |

## Infrastructure Log Management

All deployment actions are logged centrally for auditing and troubleshooting.

- **Primary Log File**: `/var/log/monetique-eye-deploy.log`
- **Frontend/Backend Dev Logs**: Integrated into the terminal session where `npm run dev` or Maven are running.

### Monitoring Logs in Real-time
To watch deployment progress across the infrastructure:
```bash
tail -f /var/log/monetique-eye-deploy.log
```

## Scaling the Infrastructure

### Adding a New Node
1. Access the Dashboard -> Environments.
2. Click **Create Environment**.
3. Provide the IP, SSH User, and Password.
4. The system will automatically trigger `deploy-agent.sh`.

### Removing a Node
1. Access the Dashboard -> Environments.
2. Click **Undeploy** on the desired node.
3. This triggers `undeploy-node.yml` to remove containers and SSH keys.

## Security Considerations
- **SSH Keys**: The platform uses `~/.ssh/id_rsa` as the primary identity for agent management.
- **StrictHostKeyChecking**: Disabled during initial setup to facilitate automation. For high-security environments, manually add host fingerprints to `known_hosts`.
