# Jenkins First-Time Setup

After deploying Jenkins, you must manually configure the required credentials in the Jenkins UI. This is a one-time setup step to enable the CI/CD pipelines.

1. Navigate to Jenkins UI at `http://<central_vm_ip>:8080`.
2. Go to **Manage Jenkins** -> **Credentials** -> **System** -> **Global credentials (unrestricted)**.
3. Click **Add Credentials**.

Create the following credentials exactly as named:

| Type | ID / Name | Description |
| :--- | :--- | :--- |
| **Secret text** | `DOCKER_REGISTRY_URL` | The URL to your internal registry (e.g., `<central_vm_ip>:5000` or `localhost:5000`). |
| **Username with password** | `DOCKER_REGISTRY_CREDS` | The username and password to authenticate with your Docker registry. |
| **SSH Username with private key** | `SSH_DEPLOY_KEY` | The SSH private key used by Jenkins to SSH into the application VMs to pull images and restart containers. |
| **Secret text** | `MONETIQUE_EYE_URL` | The URL of your Monetique Eye backend (e.g., `http://backend:8880`). |
| **Secret text** | `GITOPS_REPO_URL` | The Git repository URL where your GitOps configuration lives. |
| **Secret text** | `DB_URL_dev` / `staging` / `prod` | The JDBC URL for the backend database for the respective environment. |
| **Secret text** | `DB_PASS_dev` / `staging` / `prod` | The database password for the respective environment. |

*Note: For the DB credentials, you must create one for each environment (e.g. `DB_URL_dev`, `DB_URL_prod`, etc.).*
