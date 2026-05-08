/**
 * PromQL Query Templates for Monetique Eye Enterprise Observability
 */
export const QUERIES = {
  // A. CPU THROTTLING (%) - Using Usage Rate as surrogate
  CPU_THROTTLING: (appId: string, appName: string, nodeId: string, node: string) => 
    `rate(container_cpu_usage_seconds_total{name=~".*${appName}.*", node_id="${nodeId}"}[5m]) * 100`,

  // B. CONTAINER RESTARTS (Changes in start time)
  CONTAINER_RESTARTS: (appId: string, appName: string, nodeId: string, node: string) => 
    `changes(container_start_time_seconds{name=~".*${appName}.*", node_id="${nodeId}"}[1h])`,

  // C. MEMORY PRESSURE (%) - Verified: usage vs limit (with machine fallback)
  MEMORY_PRESSURE: (appId: string, appName: string, nodeId: string, node: string) => 
    `(container_memory_working_set_bytes{name=~".*${appName}.*", node_id="${nodeId}"} / (container_spec_memory_limit_bytes{name=~".*${appName}.*", node_id="${nodeId}"} > 0 or on(node_id) machine_memory_bytes{job="cadvisor"})) * 100`,

  // D. OOM KILL EVENTS - Verified: raw counter
  OOM_EVENTS: (appId: string, appName: string, nodeId: string, node: string) => 
    `container_oom_events_total{name=~".*${appName}.*", node_id="${nodeId}"}`,

  // E. NETWORK PACKET DROPS (Host level)
  NETWORK_DROPS: (nodeId: string, node: string) => ({
    rx: `rate(node_network_receive_drop_total{node_id="${nodeId}", device!="lo"}[5m])`,
    tx: `rate(node_network_transmit_drop_total{node_id="${nodeId}", device!="lo"}[5m])`
  }),

  // F. FILESYSTEM SATURATION
  DISK_SPACE_USED: (nodeId: string, node: string) => 
    `1 - (node_filesystem_avail_bytes{node_id="${nodeId}", mountpoint=~"/|/data" } / node_filesystem_size_bytes{node_id="${nodeId}", mountpoint=~"/|/data"})`,
  
  INODE_USED: (nodeId: string, node: string) => 
    `1 - (node_filesystem_files_free{node_id="${nodeId}", mountpoint=~"/|/data" } / node_filesystem_files{node_id="${nodeId}", mountpoint=~"/|/data"})`,

  // G. LOAD AVERAGE RATIO - Ratio > 1.0 means saturated
  LOAD_AVERAGE_RATIO: (nodeId: string, node: string) => 
    `(node_load1{node_id="${nodeId}"} / count without(cpu, mode) (node_cpu_seconds_total{node_id="${nodeId}", mode="idle"}))`,

  // H. CONTAINER UPTIME
  CONTAINER_UPTIME: (appId: string, appName: string, nodeId: string, node: string) => 
    `time() - container_start_time_seconds{name=~".*${appName}.*", node_id="${nodeId}"}`,

  // I. CPU USAGE TREND (Stacked Area)
  CPU_USAGE_STACKED: (appId: string, appName: string, nodeId: string, node: string) => 
    `rate(container_cpu_usage_seconds_total{name=~".*${appName}.*", node_id="${nodeId}"}[5m]) * 100`,

  // J. NETWORK THROUGHPUT
  NETWORK_THROUGHPUT: (appId: string, appName: string, nodeId: string, node: string) => ({
    rx: `rate(container_network_receive_bytes_total{name=~".*${appName}.*", node_id="${nodeId}"}[5m])`,
    tx: `rate(container_network_transmit_bytes_total{name=~".*${appName}.*", node_id="${nodeId}"}[5m])`
  }),

  // K. NODE INFO
  NODE_INFO: (nodeId: string, node: string) => 
    `node_uname_info{node_id="${nodeId}"}`,
  
  NODE_RESOURCES: (nodeId: string, node: string) => ({
    cpu_cores: `count without(cpu, mode) (node_cpu_seconds_total{node_id="${nodeId}", mode="idle"})`,
    memory_total: `node_memory_MemTotal_bytes{node_id="${nodeId}"}`,
    memory_used: `node_memory_MemTotal_bytes{node_id="${nodeId}"} - node_memory_MemAvailable_bytes{node_id="${nodeId}"}`
  })
};
