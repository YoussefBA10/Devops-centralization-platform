/**
 * PromQL Query Templates for Monetique Eye Enterprise Observability
 *
 * Fixes applied vs previous version:
 *  A. CPU_THROTTLING   — corrected metric names (cfs_throttled / cfs_periods); removed
 *                        semantically wrong cpu-usage fallback arms; kept zero-guard.
 *  B. CONTAINER_RESTARTS — replaced changes() with increase() for reliable restart detection.
 *  C. MEMORY_PRESSURE  — replaced broken ignoring(container) with on(name,node_id);
 *                        third arm result multiplied by 100 for consistency.
 *  D. OOM_EVENTS       — annotated node-level fallback; logic otherwise correct.
 *  F. DISK_SPACE_USED / INODE_USED — multiplied by 100 to return % not ratio (0-1).
 *  H. CONTAINER_UPTIME — added or (up{...}*0) guard to prevent duplicate series.
 *  K. NODE_RESOURCES   — fixed memory_used second arm: both sides now use the same
 *                        label (instance) so the subtraction resolves correctly.
 */
export const QUERIES = {

  // ─── A. CPU THROTTLING (%) ───────────────────────────────────────────────
  // Uses the correct cAdvisor CFS metrics.
  // Formula: throttled_seconds / total_period_seconds * 100
  // Falls back to node_id-only match when app_id label is absent, then to
  // instance label. Zero-guard ensures the panel shows 0 instead of "no data"
  // when cAdvisor is reachable but the container is not throttled at all.
  CPU_THROTTLING: (appId: string, appName: string, nodeId: string, node: string) =>
    `(
      rate(container_cpu_cfs_throttled_seconds_total{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}[5m])
      / rate(container_cpu_cfs_periods_total{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}[5m]) * 100
    )
    or
    (
      rate(container_cpu_cfs_throttled_seconds_total{name=~"(?i).*${appName}.*", node_id="${nodeId}"}[5m])
      / rate(container_cpu_cfs_periods_total{name=~"(?i).*${appName}.*", node_id="${nodeId}"}[5m]) * 100
    )
    or
    (
      rate(container_cpu_cfs_throttled_seconds_total{name=~"(?i).*${appName}.*", instance=~"${node}(:.*)?"}[5m])
      / rate(container_cpu_cfs_periods_total{name=~"(?i).*${appName}.*", instance=~"${node}(:.*)?"}[5m]) * 100
    )
    or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,


  // ─── B. CONTAINER RESTARTS ───────────────────────────────────────────────
  // increase() is more reliable than changes() — changes() counts any value
  // fluctuation (including scrape gaps) and can double-count restarts.
  // increase() on start_time > 0 correctly counts upward jumps in the window.
  CONTAINER_RESTARTS: (appId: string, appName: string, nodeId: string, node: string) =>
    `(
      increase(container_start_time_seconds{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}[10m])
    )
    or
    (
      increase(container_start_time_seconds{name=~"(?i).*${appName}.*", node_id="${nodeId}"}[10m])
    )
    or
    (
      increase(container_start_time_seconds{name=~"(?i).*${appName}.*", instance=~"${node}(:.*)?"}[10m])
    )
    or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,


  // ─── C. MEMORY PRESSURE (%) ──────────────────────────────────────────────
  // First arm:  matched by app_id label — most precise.
  // Second arm: matched by container name on the same node.
  //             on(name, node_id) replaces the broken ignoring(container) which
  //             produced a cross-join when the label set differed between metrics.
  // Third arm:  container working set vs total node memory — a last resort.
  //             This reflects host-relative pressure, not container-limit pressure.
  //             Multiply by 100 for % consistency; label in the dashboard as
  //             "memory % of node total" to avoid confusion.
  MEMORY_PRESSURE: (appId: string, appName: string, nodeId: string, node: string) =>
    `(
      (
        container_memory_working_set_bytes{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}
        / (container_spec_memory_limit_bytes{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"} > 0)
      ) * 100
    )
    or
    (
      (
        container_memory_working_set_bytes{name=~"(?i).*${appName}.*", node_id="${nodeId}"}
        / on(name, node_id) (container_spec_memory_limit_bytes{name=~"(?i).*${appName}.*", node_id="${nodeId}"} > 0)
      ) * 100
    )
    or
    (
      (
        container_memory_working_set_bytes{name=~"(?i).*${appName}.*", node_id="${nodeId}"}
        / on(node_id) group_left() node_memory_MemTotal_bytes{node_id="${nodeId}"}
      ) * 100
    )
    or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,


  // ─── D. OOM KILL EVENTS ──────────────────────────────────────────────────
  // Container-level arms are preferred (per-container accuracy).
  // The node_vmstat_oom_kill fallback is NODE-WIDE — any process OOM-kill on
  // the node will fire this arm even if your container is healthy.
  // Only use the node-level fallback as a last resort and annotate in the UI.
  OOM_EVENTS: (appId: string, appName: string, nodeId: string, node: string) =>
    `(
      increase(container_oom_events_total{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}[10m])
    )
    or
    (
      increase(container_oom_events_total{name=~"(?i).*${appName}.*", node_id="${nodeId}"}[10m])
    )
    or
    (
      increase(container_oom_events_total{name=~"(?i).*${appName}.*", instance=~"${node}(:.*)?"}[10m])
    )
    or
    (
      increase(node_vmstat_oom_kill{node_id="${nodeId}"}[10m])
    )
    or
    (
      increase(node_vmstat_oom_kill{instance=~"${node}(:.*)?"}[10m])
    )
    or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,


  // ─── E. NETWORK PACKET DROPS (host level) ────────────────────────────────
  // No changes — these were correct.
  NETWORK_DROPS: (nodeId: string, node: string) => ({
    rx: `(
      rate(node_network_receive_drop_total{node_id="${nodeId}", device!="lo"}[5m])
    ) or (
      rate(node_network_receive_drop_total{instance=~"${node}(:.*)?", device!="lo"}[5m])
    ) or (up{job="node-exporter", node_id="${nodeId}"} * 0)`,

    tx: `(
      rate(node_network_transmit_drop_total{node_id="${nodeId}", device!="lo"}[5m])
    ) or (
      rate(node_network_transmit_drop_total{instance=~"${node}(:.*)?", device!="lo"}[5m])
    ) or (up{job="node-exporter", node_id="${nodeId}"} * 0)`,
  }),


  // ─── F. FILESYSTEM SATURATION ────────────────────────────────────────────
  // Multiplied by 100 to return % (0–100) instead of a ratio (0–1).
  // node_filesystem_avail_bytes is correct (accounts for reserved blocks).
  DISK_SPACE_USED: (nodeId: string, node: string) =>
    `(
      1 - (
        node_filesystem_avail_bytes{node_id="${nodeId}", mountpoint=~"/|/data"}
        / node_filesystem_size_bytes{node_id="${nodeId}", mountpoint=~"/|/data"}
      )
    ) * 100
    or
    (
      1 - (
        node_filesystem_avail_bytes{instance=~"${node}(:.*)?", mountpoint=~"/|/data"}
        / node_filesystem_size_bytes{instance=~"${node}(:.*)?", mountpoint=~"/|/data"}
      )
    ) * 100`,

  INODE_USED: (nodeId: string, node: string) =>
    `(
      1 - (
        node_filesystem_files_free{node_id="${nodeId}", mountpoint=~"/|/data"}
        / node_filesystem_files{node_id="${nodeId}", mountpoint=~"/|/data"}
      )
    ) * 100
    or
    (
      1 - (
        node_filesystem_files_free{instance=~"${node}(:.*)?", mountpoint=~"/|/data"}
        / node_filesystem_files{instance=~"${node}(:.*)?", mountpoint=~"/|/data"}
      )
    ) * 100`,


  // ─── G. LOAD AVERAGE RATIO ───────────────────────────────────────────────
  // No changes — correct. Values > 1.0 indicate CPU saturation.
  LOAD_AVERAGE_RATIO: (nodeId: string, node: string) =>
    `(
      node_load1{node_id="${nodeId}"}
      / count without(cpu, mode) (node_cpu_seconds_total{node_id="${nodeId}", mode="idle"})
    )
    or
    (
      node_load1{instance=~"${node}(:.*)?"}
      / count without(cpu, mode) (node_cpu_seconds_total{instance=~"${node}(:.*)?", mode="idle"})
    )
    or (up{job="node-exporter", node_id="${nodeId}"} * 0)`,


  // ─── H. CONTAINER UPTIME ─────────────────────────────────────────────────
  // Added or (up{...}*0) guard — without it, multiple arms can resolve at the
  // same time when a container matches both app_id and name labels, producing
  // duplicate series on the dashboard panel.
  CONTAINER_UPTIME: (appId: string, appName: string, nodeId: string, node: string) =>
    `(
      time() - container_start_time_seconds{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}
    )
    or
    (
      time() - container_start_time_seconds{name=~"(?i).*${appName}.*", node_id="${nodeId}"}
    )
    or
    (
      time() - container_start_time_seconds{name=~"(?i).*${appName}.*", instance=~"${node}(:.*)?"}
    )
    or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,


  // ─── I. CPU USAGE TREND (stacked area) ───────────────────────────────────
  // No changes — correct. Values > 100 are normal for multi-core containers
  // (e.g. 200% = 2 cores busy). Set dashboard unit to "percent (0–∞)".
  CPU_USAGE_STACKED: (appId: string, appName: string, nodeId: string, node: string) =>
    `(
      rate(container_cpu_usage_seconds_total{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}[5m]) * 100
    )
    or
    (
      rate(container_cpu_usage_seconds_total{name=~"(?i).*${appName}.*", node_id="${nodeId}"}[5m]) * 100
    )
    or
    (
      rate(container_cpu_usage_seconds_total{name=~"(?i).*${appName}.*", instance=~"${node}(:.*)?"}[5m]) * 100
    )
    or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,


  // ─── J. NETWORK THROUGHPUT ───────────────────────────────────────────────
  // No changes — correct. Results are in bytes/sec.
  // Set dashboard panel unit to "bytes/sec" or "bits/sec" as appropriate.
  NETWORK_THROUGHPUT: (appId: string, appName: string, nodeId: string, node: string) => ({
    rx: `(
      rate(container_network_receive_bytes_total{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}[5m])
    ) or (
      rate(container_network_receive_bytes_total{name=~"(?i).*${appName}.*", node_id="${nodeId}"}[5m])
    ) or (
      rate(container_network_receive_bytes_total{name=~"(?i).*${appName}.*", instance=~"${node}(:.*)?"}[5m])
    ) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,

    tx: `(
      rate(container_network_transmit_bytes_total{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}[5m])
    ) or (
      rate(container_network_transmit_bytes_total{name=~"(?i).*${appName}.*", node_id="${nodeId}"}[5m])
    ) or (
      rate(container_network_transmit_bytes_total{name=~"(?i).*${appName}.*", instance=~"${node}(:.*)?"}[5m])
    ) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,
  }),


  // ─── K. NODE INFO ─────────────────────────────────────────────────────────
  // No changes to NODE_INFO — correct.
  NODE_INFO: (nodeId: string, node: string) =>
    `node_uname_info{node_id="${nodeId}"} or node_uname_info{instance=~"${node}(:.*)?"}`,

  // memory_used second arm fixed: both sides now use the instance label so the
  // subtraction resolves. Original had node_id on the right side while the left
  // used instance, causing a label mismatch that silently returned no data.
  NODE_RESOURCES: (nodeId: string, node: string) => ({
    cpu_cores: `
      count without(cpu, mode) (node_cpu_seconds_total{node_id="${nodeId}", mode="idle"})
      or count without(cpu, mode) (node_cpu_seconds_total{instance=~"${node}(:.*)?", mode="idle"})`,

    memory_total: `
      node_memory_MemTotal_bytes{node_id="${nodeId}"}
      or node_memory_MemTotal_bytes{instance=~"${node}(:.*)?"}`,

    memory_used: `
      (
        node_memory_MemTotal_bytes{node_id="${nodeId}"}
        - node_memory_MemAvailable_bytes{node_id="${nodeId}"}
      )
      or
      (
        node_memory_MemTotal_bytes{instance=~"${node}(:.*)?"}
        - node_memory_MemAvailable_bytes{instance=~"${node}(:.*)?"}
      )`,
  }),
};