/**
 * PromQL Query Templates for Monetique Eye Enterprise Observability
 */
export const QUERIES = {
  // A. CPU THROTTLING (%)
  CPU_THROTTLING: (appId: string) => 
    `rate(container_cpu_throttled_seconds_total{container_label_com_monetique_app_id="${appId}"}[5m]) / rate(container_cpu_usage_seconds_total{container_label_com_monetique_app_id="${appId}"}[5m]) * 100`,

  // B. CONTAINER RESTARTS (delta on start time)
  CONTAINER_RESTARTS: (appId: string) => 
    `changes(container_start_time_seconds{container_label_com_monetique_app_id="${appId}"}[1h])`,

  // C. MEMORY PRESSURE (%)
  MEMORY_PRESSURE: (appId: string) => 
    `container_memory_working_set_bytes{container_label_com_monetique_app_id="${appId}"} / container_spec_memory_limit_bytes{container_label_com_monetique_app_id="${appId}"} * 100`,

  // D. OOM KILL EVENTS
  OOM_EVENTS: (appId: string) => 
    `container_oom_events_total{container_label_com_monetique_app_id="${appId}"}`,

  // E. NETWORK PACKET DROPS (Host level fallback)
  NETWORK_DROPS: (node: string) => ({
    rx: `rate(node_network_receive_drop_total{instance=~"${node}:.*"}[5m])`,
    tx: `rate(node_network_transmit_drop_total{instance=~"${node}:.*"}[5m])`
  }),

  // F. FILESYSTEM SATURATION
  DISK_SPACE_USED: (node: string) => 
    `1 - (node_filesystem_avail_bytes{instance=~"${node}:.*", mountpoint="/" } / node_filesystem_size_bytes{instance=~"${node}:.*", mountpoint="/"})`,
  
  INODE_USED: (node: string) => 
    `1 - (node_filesystem_files_free{instance=~"${node}:.*", mountpoint="/" } / node_filesystem_files{instance=~"${node}:.*", mountpoint="/"})`,

  // G. LOAD AVERAGE RATIO
  LOAD_AVERAGE_RATIO: (node: string) => 
    `node_load1{instance=~"${node}:.*"} / count(node_cpu_seconds_total{instance=~"${node}:.*", mode="idle"})`,

  // H. CONTAINER UPTIME
  CONTAINER_UPTIME: (appId: string) => 
    `time() - container_start_time_seconds{container_label_com_monetique_app_id="${appId}"}`,

  // I. CPU USAGE TREND (Stacked Area)
  CPU_USAGE_STACKED: (appId: string) => 
    `rate(container_cpu_usage_seconds_total{container_label_com_monetique_app_id="${appId}"}[5m]) * 100`,

  // J. NETWORK THROUGHPUT
  NETWORK_THROUGHPUT: (appId: string) => ({
    rx: `rate(container_network_receive_bytes_total{container_label_com_monetique_app_id="${appId}"}[5m])`,
    tx: `rate(container_network_transmit_bytes_total{container_label_com_monetique_app_id="${appId}"}[5m])`
  }),

  // K. NODE INFO
  NODE_INFO: (node: string) => 
    `node_uname_info{instance=~"${node}:.*"}`,
  
  NODE_RESOURCES: (node: string) => ({
    cpu_cores: `count(node_cpu_seconds_total{instance=~"${node}:.*", mode="idle"})`,
    memory_total: `node_memory_MemTotal_bytes{instance=~"${node}:.*"}`,
    memory_used: `node_memory_MemTotal_bytes{instance=~"${node}:.*"} - node_memory_MemAvailable_bytes{instance=~"${node}:.*"}`
  })
};
