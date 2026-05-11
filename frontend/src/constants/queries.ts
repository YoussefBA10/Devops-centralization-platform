/**
 * PromQL Query Templates for Monetique Eye Enterprise Observability
 *
 * IMPORTANT NOTES ON "ZERO" VALUES:
 * - Restart Events = 0 → No containers restarted in the last 10m (EXPECTED if stable)
 * - OOM Events = 0     → No OOM kills on the node (EXPECTED if healthy)
 * - Packet Drops = 0   → No network drops (EXPECTED if network is healthy)
 * - Memory Pressure = 0 → Query mismatch (BUG if container is running)
 *
 * The "or (up{...} * 0)" fallback at the end of each query ensures the chart
 * always renders a flat zero line instead of "No Data" when the primary arms
 * don't match. This is by design — a flat zero IS the correct value for
 * event counters (restarts, OOM, drops) when no events occurred.
 */
export const QUERIES = {
  // ─── A. CPU THROTTLING (%) ───────────────────────────────────────────────
  CPU_THROTTLING: (_appId: string, appName: string, nodeId: string, node: string) =>
    `(rate(container_cpu_cfs_throttled_seconds_total{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m]) / rate(container_cpu_cfs_periods_total{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m]) * 100) or (rate(container_cpu_cfs_throttled_seconds_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m]) / rate(container_cpu_cfs_periods_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m]) * 100) or (rate(container_cpu_cfs_throttled_seconds_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", instance=~"${node}(:.*)?", id=~"/docker/.*"}[5m]) / rate(container_cpu_cfs_periods_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", instance=~"${node}(:.*)?", id=~"/docker/.*"}[5m]) * 100) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,

  // ─── B. CONTAINER RESTARTS ───────────────────────────────────────────────
  // 0 = no restarts in last 10 minutes (this is NORMAL for stable containers)
  CONTAINER_RESTARTS: (_appId: string, appName: string, nodeId: string, node: string) =>
    `(increase(container_start_time_seconds{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[10m])) or (increase(container_start_time_seconds{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[10m])) or (increase(container_start_time_seconds{container_label_com_docker_compose_service=~"(?i).*${appName}.*", instance=~"${node}(:.*)?", id=~"/docker/.*"}[10m])) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,

  // ─── C. MEMORY PRESSURE (%) ──────────────────────────────────────────────
  // Arm 1: working_set / limit (only works if Docker --memory limit is set)
  // Arm 2: same with compose service label
  // Arm 1: limit-based (only when real Docker --memory limit is set, < 1PB)
  // Arm 2: machine memory fallback via on(node_id) group_left()
  MEMORY_PRESSURE: (_appId: string, appName: string, nodeId: string, _node: string) =>
    `((container_memory_working_set_bytes{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"} / (container_spec_memory_limit_bytes{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"} > 0 < 1e15)) * 100) or ((container_memory_working_set_bytes{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"} / (container_spec_memory_limit_bytes{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"} > 0 < 1e15)) * 100) or ((container_memory_working_set_bytes{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"} / on(node_id) group_left() node_memory_MemTotal_bytes{node_id="${nodeId}"}) * 100) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,

  // ─── D. OOM KILL EVENTS ──────────────────────────────────────────────────
  // 0 = no OOM kills on the node (NORMAL — this is a good thing)
  // node_vmstat_oom_kill is node-wide, not per-container
  OOM_EVENTS: (_appId: string, _appName: string, nodeId: string, node: string) =>
    `(increase(node_vmstat_oom_kill{node_id="${nodeId}"}[10m])) or (increase(node_vmstat_oom_kill{instance=~"${node}(:.*)?"}[10m])) or (up{job="node-exporter", node_id="${nodeId}"} * 0)`,

  // ─── E. NETWORK PACKET DROPS (host level) ────────────────────────────────
  // 0 = healthy network, no drops (NORMAL)
  NETWORK_DROPS: (nodeId: string, node: string) => ({
    rx: `(rate(node_network_receive_drop_total{node_id="${nodeId}", device!="lo"}[5m])) or (rate(node_network_receive_drop_total{instance=~"${node}(:.*)?", device!="lo"}[5m])) or (up{job="node-exporter", node_id="${nodeId}"} * 0)`,
    tx: `(rate(node_network_transmit_drop_total{node_id="${nodeId}", device!="lo"}[5m])) or (rate(node_network_transmit_drop_total{instance=~"${node}(:.*)?", device!="lo"}[5m])) or (up{job="node-exporter", node_id="${nodeId}"} * 0)`
  }),

  // ─── F. FILESYSTEM SATURATION ────────────────────────────────────────────
  DISK_SPACE_USED: (nodeId: string, node: string) =>
    `(1 - (node_filesystem_avail_bytes{node_id="${nodeId}", mountpoint=~"/|/data"} / node_filesystem_size_bytes{node_id="${nodeId}", mountpoint=~"/|/data"})) or (1 - (node_filesystem_avail_bytes{instance=~"${node}(:.*)?", mountpoint=~"/|/data"} / node_filesystem_size_bytes{instance=~"${node}(:.*)?", mountpoint=~"/|/data"}))`,

  INODE_USED: (nodeId: string, node: string) =>
    `(1 - (node_filesystem_files_free{node_id="${nodeId}", mountpoint=~"/|/data"} / node_filesystem_files{node_id="${nodeId}", mountpoint=~"/|/data"})) * 100 or (1 - (node_filesystem_files_free{instance=~"${node}(:.*)?", mountpoint=~"/|/data"} / node_filesystem_files{instance=~"${node}(:.*)?", mountpoint=~"/|/data"})) * 100`,

  // ─── G. LOAD AVERAGE RATIO ───────────────────────────────────────────────
  LOAD_AVERAGE_RATIO: (nodeId: string, node: string) =>
    `(node_load1{node_id="${nodeId}"} / count without(cpu, mode) (node_cpu_seconds_total{node_id="${nodeId}", mode="idle"})) or (node_load1{instance=~"${node}(:.*)?"} / count without(cpu, mode) (node_cpu_seconds_total{instance=~"${node}(:.*)?", mode="idle"})) or (up{job="node-exporter", node_id="${nodeId}"} * 0)`,

  // ─── H. CONTAINER UPTIME ─────────────────────────────────────────────────
  CONTAINER_UPTIME: (_appId: string, appName: string, nodeId: string, node: string) =>
    `(time() - container_start_time_seconds{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}) or (time() - container_start_time_seconds{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}) or (time() - container_start_time_seconds{container_label_com_docker_compose_service=~"(?i).*${appName}.*", instance=~"${node}(:.*)?", id=~"/docker/.*"}) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,

  // ─── I. CPU USAGE TREND (stacked area) ───────────────────────────────────
  CPU_USAGE_STACKED: (_appId: string, appName: string, nodeId: string, node: string) =>
    `(rate(container_cpu_usage_seconds_total{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m]) * 100) or (rate(container_cpu_usage_seconds_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m]) * 100) or (rate(container_cpu_usage_seconds_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", instance=~"${node}(:.*)?", id=~"/docker/.*"}[5m]) * 100) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,

  // ─── J. NETWORK THROUGHPUT ───────────────────────────────────────────────
  NETWORK_THROUGHPUT: (_appId: string, appName: string, nodeId: string, node: string) => ({
    rx: `(rate(container_network_receive_bytes_total{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m])) or (rate(container_network_receive_bytes_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m])) or (rate(container_network_receive_bytes_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", instance=~"${node}(:.*)?", id=~"/docker/.*"}[5m])) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,
    tx: `(rate(container_network_transmit_bytes_total{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m])) or (rate(container_network_transmit_bytes_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m])) or (rate(container_network_transmit_bytes_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", instance=~"${node}(:.*)?", id=~"/docker/.*"}[5m])) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`
  }),

  // ─── K. NODE INFO & RESOURCES ────────────────────────────────────────────
  NODE_INFO: (nodeId: string, node: string) =>
    `node_uname_info{node_id="${nodeId}"} or node_uname_info{instance=~"${node}(:.*)?"}`,

  NODE_RESOURCES: (nodeId: string, node: string) => ({
    cpu_cores: `count without(cpu, mode) (node_cpu_seconds_total{node_id="${nodeId}", mode="idle"}) or count without(cpu, mode) (node_cpu_seconds_total{instance=~"${node}(:.*)?", mode="idle"})`,
    memory_total: `node_memory_MemTotal_bytes{node_id="${nodeId}"} or node_memory_MemTotal_bytes{instance=~"${node}(:.*)?"}`,
    memory_used: `(node_memory_MemTotal_bytes{node_id="${nodeId}"} - node_memory_MemAvailable_bytes{node_id="${nodeId}"}) or (node_memory_MemTotal_bytes{instance=~"${node}(:.*)?"} - node_memory_MemAvailable_bytes{instance=~"${node}(:.*)?"})`
  }),
};
