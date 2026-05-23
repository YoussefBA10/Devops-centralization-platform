# Monetique Eye: Incident and Alerting System

This document describes the incident management and alerting features currently implemented in the Monetique Eye platform.

## 1. Monitoring & Alerting Infrastructure
The platform uses **Prometheus** for metric collection and **Alertmanager** for alert orchestration.

### Key Alert Categories
*   **System Alerts**: Monitoring infrastructure health.
    *   `NodeUnreachable`: Critical alert if a monitoring agent (Node Exporter) stops responding.
    *   `HighCpuUsage`: Warning if CPU usage exceeds 85% for more than 2 minutes.
    *   `HighMemoryUsage`: Warning if memory usage exceeds 90%.
    *   `NodeDiskSpaceLow`: Warning if available disk space falls below 15%.
*   **Application Alerts**: Monitoring service availability and performance.
    *   `BackendDown` / `FrontendDown`: Critical alerts for service unavailability.
    *   `HighErrorRate`: Critical alert if 5xx error rates exceed 5% over 2 minutes.
    *   `HighLatency`: Warning if 95th percentile latency exceeds 2 seconds.
*   **Container Alerts**: Granular monitoring of containerized workloads.
    *   `ContainerOOMKilled`: Critical alert if a container is terminated due to memory exhaustion.
    *   `ContainerRestartLoop`: Critical alert if a container restarts more than 2 times in 15 minutes.
    *   `ContainerCPUFreeze`: Warning for heavy CPU throttling.

## 2. Alerts & Diagnostics Dashboard
A dedicated frontend component (`AlertsAndDiagnosticsTab.tsx`) provides a real-time view of the system's health.

### Features:
*   **Active Alerts Panel**: Displays live alerts categorized by severity (Critical/Warning).
*   **Alert Silencing**: Ability to temporarily silence specific alerts directly from the UI.
*   **Rule Management**: A centralized interface to view, add, and delete alerting rules.
*   **Automatic Refresh**: The dashboard polls the Alertmanager API every 30 seconds to ensure data accuracy.

## 3. Incident Management System
Beyond raw alerts, the platform implements a structured `Incident` entity in the backend to manage system failures.

### Core Components:
*   **Application Association**: Every incident is linked to a specific application in the inventory.
*   **AI Summarization**: The system supports generating intelligent summaries of incidents (via `aiSummary` field) to help operators understand root causes faster.
*   **Ticketing Integration**: Incidents can be linked to `Tickets`, creating a bridge between observability and workflow management.
*   **Data Model**:
    *   `Incident`: Stores metadata, AI analysis, and relationship to applications/tickets.
    *   `IncidentDTO`: Standardized data transfer for frontend consumption.

## 4. Notification Flow
1.  **Detection**: Prometheus evaluates rules against scraped metrics.
2.  **Firing**: When a threshold is met, Prometheus sends the alert to Alertmanager.
3.  **Visualization**: The Frontend fetches active alerts from Alertmanager.
4.  **Incident Creation**: (Operational Flow) Critical alerts can be promoted to Incidents in the backend for deeper analysis and tracking.

## 5. Analyse Dashboard
A dedicated visualization component providing deep insights into historical incidents, system performance, and predictive analytics.

### Features:
*   **Historical Trends**: Analyze incident frequency, resolution times, and impact over customizable timeframes.
*   **Root Cause Analysis**: Leverage AI-powered aggregation of common failure patterns across applications. Capabilities include:
    *   **Log Correlation**: Automatically collates error logs, traces, and metrics associated with an incident to pinpoint the exact failure origin.
    *   **Dependency Mapping**: Identifies downstream services, network issues, or database bottlenecks that triggered cascading failures.
    *   **AI Insights**: Utilizes integrated AI models to interpret complex stack traces and provide actionable, human-readable explanations of failure mechanisms.
*   **Long-Term Performance Metrics**: Visualization of long-term metric aggregation to identify systemic degradation before it triggers critical alerts.
*   **Custom Reporting**: Generate and export reports for SLA (Service Level Agreement) tracking, compliance, and team reviews.
