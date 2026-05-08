/**
 * PromQL Query Templates for Monetique Eye Enterprise Observability
 */
export const QUERIES = {
  // A. CPU THROTTLING (%)
  CPU_THROTTLING: (appId: string, appName: string, nodeId: string) => 
    `(rate(container_cpu_throttled_seconds_total{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}[5m]) / (rate(container_cpu_usage_seconds_total{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}[5m]) > 0) * 100) or (rate(container_cpu_throttled_seconds_total{name=~".*${appName}.*", node_id="${nodeId}"}[5m]) / (rate(container_cpu_usage_seconds_total{name=~".*${appName}.*", node_id="${nodeId}"}[5m]) > 0) * 100) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,

  // B. CONTAINER RESTARTS (delta on start time)
  CONTAINER_RESTARTS: (appId: string, appName: string, nodeId: string) => 
    `(changes(container_start_time_seconds{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}[1h]) or changes(container_start_time_seconds{name=~".*${appName}.*", node_id="${nodeId}"}[1h])) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,

  // C. MEMORY PRESSURE (%)
  MEMORY_PRESSURE: (appId: string, appName: string, nodeId: string) => 
    `((container_memory_working_set_bytes{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"} / (container_spec_memory_limit_bytes{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"} > 0 or on(node_id) machine_memory_bytes{job="cadvisor"})) * 100) or ((container_memory_working_set_bytes{name=~".*${appName}.*", node_id="${nodeId}"} / (container_spec_memory_limit_bytes{name=~".*${appName}.*", node_id="${nodeId}"} > 0 or on(node_id) machine_memory_bytes{job="cadvisor"})) * 100) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,

  // D. OOM KILL EVENTS
  OOM_EVENTS: (appId: string, appName: string, nodeId: string) => 
    `(container_oom_events_total{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"} or container_oom_events_total{name=~".*${appName}.*", node_id="${nodeId}"}) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,

  // E. NETWORK PACKET DROPS (Host level)
  NETWORK_DROPS: (nodeId: string) => ({
    rx: `rate(node_network_receive_drop_total{node_id="${nodeId}"}[5m]) or (up{job="node-exporter", node_id="${nodeId}"} * 0)`,
    tx: `rate(node_network_transmit_drop_total{node_id="${nodeId}"}[5m]) or (up{job="node-exporter", node_id="${nodeId}"} * 0)`
  }),

  // F. FILESYSTEM SATURATION
  DISK_SPACE_USED: (nodeId: string) => 
    `1 - (node_filesystem_avail_bytes{node_id="${nodeId}", mountpoint=~"/|/data" } / node_filesystem_size_bytes{node_id="${nodeId}", mountpoint=~"/|/data"})`,
  
  INODE_USED: (nodeId: string) => 
    `1 - (node_filesystem_files_free{node_id="${nodeId}", mountpoint=~"/|/data" } / node_filesystem_files{node_id="${nodeId}", mountpoint=~"/|/data"})`,

  // G. LOAD AVERAGE RATIO
  LOAD_AVERAGE_RATIO: (nodeId: string) => 
    `(node_load1{node_id="${nodeId}"} / count(node_cpu_seconds_total{node_id="${nodeId}", mode="idle"})) or (up{job="node-exporter", node_id="${nodeId}"} * 0)`,

  // H. CONTAINER UPTIME
  CONTAINER_UPTIME: (appId: string, appName: string, nodeId: string) => 
    `(time() - container_start_time_seconds{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}) or (time() - container_start_time_seconds{name=~".*${appName}.*", node_id="${nodeId}"})`,

  // I. CPU USAGE TREND (Stacked Area)
  CPU_USAGE_STACKED: (appId: string, appName: string, nodeId: string) => 
    `(rate(container_cpu_usage_seconds_total{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}[5m]) * 100 or rate(container_cpu_usage_seconds_total{name=~".*${appName}.*", node_id="${nodeId}"}[5m]) * 100) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,

  // J. NETWORK THROUGHPUT
  NETWORK_THROUGHPUT: (appId: string, appName: string, nodeId: string) => ({
    rx: `(rate(container_network_receive_bytes_total{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}[5m]) or rate(container_network_receive_bytes_total{name=~".*${appName}.*", node_id="${nodeId}"}[5m])) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,
    tx: `(rate(container_network_transmit_bytes_total{container_label_com_monetique_app_id="${appId}", node_id="${nodeId}"}[5m]) or rate(container_network_transmit_bytes_total{name=~".*${appName}.*", node_id="${nodeId}"}[5m])) or (up{job="cadvisor", node_id="${nodeId}"} * 0)`
  }),

  // K. NODE INFO
  NODE_INFO: (nodeId: string) => 
    `node_uname_info{node_id="${nodeId}"}`,
  
  NODE_RESOURCES: (nodeId: string) => ({
    cpu_cores: `count(node_cpu_seconds_total{node_id="${nodeId}", mode="idle"})`,
    memory_total: `node_memory_MemTotal_bytes{node_id="${nodeId}"}`,
    memory_used: `node_memory_MemTotal_bytes{node_id="${nodeId}"} - node_memory_MemAvailable_bytes{node_id="${nodeId}"}`
  })
};
