# Application Observability Dashboard Guide

The **Application Observability Dashboard** provides real-time, infrastructure-native monitoring for all applications deployed through the Monetique Eye platform(With only node-exporter and cadvisor). Unlike legacy systems that require manual metric configuration, this dashboard automatically discovers and visualizes metrics using container-level signals.

## Dashboard Overview

Access URL: `http://ip/observability/apps/{appId}/dashboard`

### 1. Scrape Connectivity Status
Located at the top of the page, this status indicator verifies the end-to-end data flow between your application container and Prometheus.
*   **UP**: The container is active, correctly labeled, and Prometheus is successfully scraping metrics.
*   **NOT_FOUND**: The application is deployed, but Prometheus hasn't discovered the container yet (Discovery can take up to 60-90 seconds).
*   **ERROR**: There is a communication issue between the dashboard and the Prometheus API.

### 2. Infrastructure Golden Signals
The dashboard visualizes four critical infrastructure metrics (The Golden Signals):

| Metric | Description | Source |
| :--- | :--- | :--- |
| **CPU Usage** | Percentage of CPU consumed by the container relative to host capacity. | cAdvisor |
| **Memory Usage** | Resident Set Size (RSS) memory consumed by the application in MB. | cAdvisor |
| **Network I/O** | Real-time network throughput (Receive/Transmit) in KB/s. | cAdvisor |
| **Disk Usage** | Filesystem usage by the container's writable layer in MB. | cAdvisor |

## How Discovery Works

The system uses a **Zero-Config** observability model:
1.  **Label Injection**: During deployment, the Ansible engine automatically injects the label `com.monetique.app_id={id}` into the Docker container.
2.  **Dynamic Discovery**: Prometheus scrapes the `cAdvisor` agent on each node.
3.  **Intelligent Mapping**: The dashboard queries Prometheus using the `app_id` label. If the label is not yet indexed, it automatically falls back to matching by the Docker `container_name`.

## Troubleshooting

*   **No Data Points**: If the charts are empty but the status is **UP**, it means the container just started. Prometheus requires at least 2 minutes of data to calculate rates (like CPU and Network).
*   **Persistent NOT_FOUND**: Verify that the `cadvisor` container is running on the target agent node and that the agent node has connectivity to the central Prometheus server.
