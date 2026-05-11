/**
 * PromQL Query Templates for Monetique Eye Enterprise Observability
 */
export const QUERIES = {
  // A. CPU THROTTLING (%) - Surrogate using usage rate if throttling is unavailable
  CPU_THROTTLING: (appId: string, appName: string, nodeId: string, node: string) =>
    `(sum(rate(container_cpu_throttled_seconds_total{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}[5m])) / sum(rate(container_cpu_usage_seconds_total{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}[5m]) > 0) * 100) or (sum(rate(container_cpu_throttled_seconds_total{name=~".*${appName}.*", node_id="${nodeId}"}[5m])) / sum(rate(container_cpu_usage_seconds_total{name=~".*${appName}.*", node_id="${nodeId}"}[5m]) > 0) * 100) or (sum(rate(container_cpu_throttled_seconds_total{name=~".*${appName}.*", instance=~"${node}(:.*)?"}[5m])) / sum(rate(container_cpu_usage_seconds_total{name=~".*${appName}.*", instance=~"${node}(:.*)?"}[5m]) > 0) * 100) or sum(up{job="cadvisor", node_id="${nodeId}"}) * 0`,

  // B. CONTAINER RESTARTS - Detecting jumps in start time
  CONTAINER_RESTARTS: (appId: string, appName: string, nodeId: string, node: string) =>
    `count(time() - container_start_time_seconds{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"} < 600) or count(time() - container_start_time_seconds{name=~".*${appName}.*", node_id="${nodeId}"} < 600) or count(time() - container_start_time_seconds{name=~".*${appName}.*", instance=~"${node}(:.*)?"} < 600) or sum(up{job="cadvisor", node_id="${nodeId}"}) * 0`,

  // C. MEMORY PRESSURE (%) - High precision limit-based matching
  MEMORY_PRESSURE: (appId: string, appName: string, nodeId: string, node: string) =>
    `(sum(container_memory_working_set_bytes{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}) / sum(container_spec_memory_limit_bytes{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"} > 0 < 1e15) * 100) or (sum(container_memory_working_set_bytes{name=~".*${appName}.*", node_id="${nodeId}"}) / sum(container_spec_memory_limit_bytes{name=~".*${appName}.*", node_id="${nodeId}"} > 0 < 1e15) * 100) or (sum(container_memory_working_set_bytes{name=~".*${appName}.*", instance=~"${node}(:.*)?"}) / sum(container_spec_memory_limit_bytes{name=~".*${appName}.*", instance=~"${node}(:.*)?"} > 0 < 1e15) * 100) or (sum(container_memory_working_set_bytes{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}) / sum(node_memory_MemTotal_bytes{node_id="${nodeId}"}) * 100) or (sum(container_memory_working_set_bytes{name=~".*${appName}.*", node_id="${nodeId}"}) / sum(node_memory_MemTotal_bytes{node_id="${nodeId}"}) * 100) or (sum(container_memory_working_set_bytes{name=~".*${appName}.*", instance=~"${node}(:.*)?"}) / sum(node_memory_MemTotal_bytes{instance=~"${node}(:.*)?"}) * 100) or sum(up{job="cadvisor", node_id="${nodeId}"}) * 0`,

  // D. OOM KILL EVENTS - Using increase() for reliable event capture
  OOM_EVENTS: (appId: string, appName: string, nodeId: string, node: string) =>
    `sum(increase(container_oom_events_total{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}[10m])) or sum(increase(container_oom_events_total{name=~".*${appName}.*", node_id="${nodeId}"}[10m])) or sum(increase(container_oom_events_total{name=~".*${appName}.*", instance=~"${node}(:.*)?"}[10m])) or sum(increase(node_vmstat_oom_kill{node_id="${nodeId}"}[10m])) or sum(increase(node_vmstat_oom_kill{instance=~"${node}(:.*)?"}[10m])) or sum(up{job="cadvisor", node_id="${nodeId}"}) * 0`,

  // E. NETWORK PACKET DROPS (Host level)
  NETWORK_DROPS: (nodeId: string, node: string) => ({
    rx: `sum(rate(node_network_receive_drop_total{node_id="${nodeId}", device!="lo"}[5m])) or sum(rate(node_network_receive_drop_total{instance=~"${node}(:.*)?", device!="lo"}[5m])) or sum(up{job="node-exporter", node_id="${nodeId}"}) * 0`,
    tx: `sum(rate(node_network_transmit_drop_total{node_id="${nodeId}", device!="lo"}[5m])) or sum(rate(node_network_transmit_drop_total{instance=~"${node}(:.*)?", device!="lo"}[5m])) or sum(up{job="node-exporter", node_id="${nodeId}"}) * 0`
  }),

  // F. FILESYSTEM SATURATION
  DISK_SPACE_USED: (nodeId: string, node: string) =>
    `1 - (node_filesystem_avail_bytes{node_id="${nodeId}", mountpoint=~"/|/data" } / node_filesystem_size_bytes{node_id="${nodeId}", mountpoint=~"/|/data"}) or 1 - (node_filesystem_avail_bytes{instance=~"${node}(:.*)?", mountpoint=~"/|/data" } / node_filesystem_size_bytes{instance=~"${node}(:.*)?", mountpoint=~"/|/data"})`,

  INODE_USED: (nodeId: string, node: string) =>
    `1 - (node_filesystem_files_free{node_id="${nodeId}", mountpoint=~"/|/data" } / node_filesystem_files{node_id="${nodeId}", mountpoint=~"/|/data"}) or 1 - (node_filesystem_files_free{instance=~"${node}(:.*)?", mountpoint=~"/|/data" } / node_filesystem_files{instance=~"${node}(:.*)?", mountpoint=~"/|/data"})`,

  // G. LOAD AVERAGE RATIO
  LOAD_AVERAGE_RATIO: (nodeId: string, node: string) =>
    `(node_load1{node_id="${nodeId}"} / count without(cpu, mode) (node_cpu_seconds_total{node_id="${nodeId}", mode="idle"})) or (node_load1{instance=~"${node}(:.*)?"} / count without(cpu, mode) (node_cpu_seconds_total{instance=~"${node}(:.*)?", mode="idle"})) or (up{job="node-exporter", node_id="${nodeId}"} * 0)`,

  // H. CONTAINER UPTIME
  CONTAINER_UPTIME: (appId: string, appName: string, nodeId: string, node: string) =>
    `(time() - container_start_time_seconds{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}) or (time() - container_start_time_seconds{name=~".*${appName}.*", node_id="${nodeId}"}) or (time() - container_start_time_seconds{name=~".*${appName}.*", instance=~"${node}(:.*)?"})`,

  // I. CPU USAGE TREND (Stacked Area)
  CPU_USAGE_STACKED: (appId: string, appName: string, nodeId: string, node: string) =>
    `(sum(rate(container_cpu_usage_seconds_total{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}[5m])) * 100 or sum(rate(container_cpu_usage_seconds_total{name=~".*${appName}.*", node_id="${nodeId}"}[5m])) * 100 or sum(rate(container_cpu_usage_seconds_total{name=~".*${appName}.*", instance=~"${node}(:.*)?"}[5m])) * 100) or sum(up{job="cadvisor", node_id="${nodeId}"}) * 0`,

  // J. NETWORK THROUGHPUT
  NETWORK_THROUGHPUT: (appId: string, appName: string, nodeId: string, node: string) => ({
    rx: `(rate(container_network_receive_bytes_total{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}[5m]) or rate(container_network_receive_bytes_total{name=~".*${appName}.*", node_id="${nodeId}"}[5m]) or rate(container_network_receive_bytes_total{name=~".*${appName}.*", instance=~"${node}(:.*)?"}[5m])) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,
    tx: `(rate(container_network_transmit_bytes_total{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}[5m]) or rate(container_network_transmit_bytes_total{name=~".*${appName}.*", node_id="${nodeId}"}[5m]) or rate(container_network_transmit_bytes_total{name=~".*${appName}.*", instance=~"${node}(:.*)?"}[5m])) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`
  }),

  // K. NODE INFO
  NODE_INFO: (nodeId: string, node: string) =>
    `node_uname_info{node_id="${nodeId}"} or node_uname_info{instance=~"${node}(:.*)?"}`,

  NODE_RESOURCES: (nodeId: string, node: string) => ({
    cpu_cores: `count without(cpu, mode) (node_cpu_seconds_total{node_id="${nodeId}", mode="idle"}) or count without(cpu, mode) (node_cpu_seconds_total{instance=~"${node}(:.*)?", mode="idle"})`,
    memory_total: `node_memory_MemTotal_bytes{node_id="${nodeId}"} or node_memory_MemTotal_bytes{instance=~"${node}(:.*)?"}`,
    memory_used: `(node_memory_MemTotal_bytes{node_id="${nodeId}"} - node_memory_MemAvailable_bytes{node_id="${nodeId}"}) or (node_memory_MemTotal_bytes{instance=~"${node}(:.*)?"} - node_memory_MemAvailable_bytes{node_id="${nodeId}"})`
  })
};
