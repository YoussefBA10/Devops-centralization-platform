/**
 * PromQL Query Templates for Monetique Eye Enterprise Observability
 */
export const QUERIES = {
  // ─── A. CPU THROTTLING (%) ───────────────────────────────────────────────
  CPU_THROTTLING: (_appId: string, appName: string, nodeId: string, node: string) =>
    `(rate(container_cpu_cfs_throttled_seconds_total{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m]) / rate(container_cpu_cfs_periods_total{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m]) * 100) or (rate(container_cpu_cfs_throttled_seconds_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m]) / rate(container_cpu_cfs_periods_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m]) * 100) or (rate(container_cpu_cfs_throttled_seconds_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", instance=~"${node}(:.*)?", id=~"/docker/.*"}[5m]) / rate(container_cpu_cfs_periods_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", instance=~"${node}(:.*)?", id=~"/docker/.*"}[5m]) * 100) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,

  // ─── B. CONTAINER RESTARTS ───────────────────────────────────────────────
  CONTAINER_RESTARTS: (_appId: string, appName: string, nodeId: string, node: string) =>
    `(increase(container_start_time_seconds{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[10m])) or (increase(container_start_time_seconds{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[10m])) or (increase(container_start_time_seconds{container_label_com_docker_compose_service=~"(?i).*${appName}.*", instance=~"${node}(:.*)?", id=~"/docker/.*"}[10m])) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,

  // ─── C. MEMORY PRESSURE (%) ──────────────────────────────────────────────
  MEMORY_PRESSURE: (_appId: string, appName: string, nodeId: string, _node: string) =>
    `((container_memory_working_set_bytes{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"} / (container_spec_memory_limit_bytes{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"} > 0)) * 100) or ((container_memory_working_set_bytes{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"} / on(container_label_com_docker_compose_service, node_id) (container_spec_memory_limit_bytes{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"} > 0)) * 100) or ((container_memory_working_set_bytes{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"} / on(node_id) group_left() node_memory_MemTotal_bytes{node_id="${nodeId}"}) * 100) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,

  // ─── D. OOM KILL EVENTS ──────────────────────────────────────────────────
  OOM_EVENTS: (_appId: string, _appName: string, nodeId: string, node: string) =>
    `(increase(node_vmstat_oom_kill{node_id="${nodeId}"}[10m])) or (increase(node_vmstat_oom_kill{instance=~"${node}(:.*)?"}[10m])) or (up{job="node-exporter", node_id="${nodeId}"} * 0)`,

  // ─── E. NETWORK PACKET DROPS (host level) ────────────────────────────────
  NETWORK_DROPS: (nodeId: string, node: string) => ({
    rx: `(rate(node_network_receive_drop_total{node_id="${nodeId}", device!="lo"}[5m])) or (rate(node_network_receive_drop_total{instance=~"${node}(:.*)?", device!="lo"}[5m])) or (up{job="node-exporter", node_id="${nodeId}"} * 0)`,
    tx: `(rate(node_network_transmit_drop_total{node_id="${nodeId}", device!="lo"}[5m])) or (rate(node_network_transmit_drop_total{instance=~"${node}(:.*)?", device!="lo"}[5m])) or (up{job="node-exporter", node_id="${nodeId}"} * 0)`
  }),

  // ─── F. FILESYSTEM SATURATION ────────────────────────────────────────────
  DISK_SPACE_USED: (nodeId: string, node: string) =>
    `(1 - (node_filesystem_avail_bytes{node_id="${nodeId}", mountpoint=~"/|/data"} / node_filesystem_size_bytes{node_id="${nodeId}", mountpoint=~"/|/data"})) * 100 or (1 - (node_filesystem_avail_bytes{instance=~"${node}(:.*)?", mountpoint=~"/|/data"} / node_filesystem_size_bytes{instance=~"${node}(:.*)?", mountpoint=~"/|/data"})) * 100`,

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