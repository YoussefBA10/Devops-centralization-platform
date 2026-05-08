/**
 * PromQL Query Templates for Monetique Eye Enterprise Observability
 */
export const QUERIES = {
  // A. CPU THROTTLING (%)
  CPU_THROTTLING: (appId: string, appName: string, node: string) => 
    `(rate(container_cpu_throttled_seconds_total{container_label_com_monetique_app_id="${appId}", instance=~"${node}(:.*)?"}[5m]) / (rate(container_cpu_usage_seconds_total{container_label_com_monetique_app_id="${appId}", instance=~"${node}(:.*)?"}[5m]) > 0) * 100) or (rate(container_cpu_throttled_seconds_total{name=~".*${appName}.*", instance=~"${node}(:.*)?"}[5m]) / (rate(container_cpu_usage_seconds_total{name=~".*${appName}.*", instance=~"${node}(:.*)?"}[5m]) > 0) * 100) or (up{job="cadvisor", instance=~"${node}(:.*)?"} * 0)`,

  // B. CONTAINER RESTARTS (delta on start time)
  CONTAINER_RESTARTS: (appId: string, appName: string, node: string) => 
    `(changes(container_start_time_seconds{container_label_com_monetique_app_id="${appId}", instance=~"${node}(:.*)?"}[1h]) or changes(container_start_time_seconds{name=~".*${appName}.*", instance=~"${node}(:.*)?"}[1h])) or (up{job="cadvisor", instance=~"${node}(:.*)?"} * 0)`,

  // C. MEMORY PRESSURE (%)
  MEMORY_PRESSURE: (appId: string, appName: string, node: string) => 
    `((container_memory_working_set_bytes{container_label_com_monetique_app_id="${appId}", instance=~"${node}(:.*)?"} / (container_spec_memory_limit_bytes{container_label_com_monetique_app_id="${appId}", instance=~"${node}(:.*)?"} > 0 or on(instance) machine_memory_bytes{job="cadvisor"})) * 100) or ((container_memory_working_set_bytes{name=~".*${appName}.*", instance=~"${node}(:.*)?"} / (container_spec_memory_limit_bytes{name=~".*${appName}.*", instance=~"${node}(:.*)?"} > 0 or on(instance) machine_memory_bytes{job="cadvisor"})) * 100) or (up{job="cadvisor", instance=~"${node}(:.*)?"} * 0)`,

  // D. OOM KILL EVENTS
  OOM_EVENTS: (appId: string, appName: string, node: string) => 
    `(container_oom_events_total{container_label_com_monetique_app_id="${appId}", instance=~"${node}(:.*)?"} or container_oom_events_total{name=~".*${appName}.*", instance=~"${node}(:.*)?"}) or (up{job="cadvisor", instance=~"${node}(:.*)?"} * 0)`,

  // E. NETWORK PACKET DROPS (Host level)
  NETWORK_DROPS: (node: string) => ({
    rx: `rate(node_network_receive_drop_total{instance=~"${node}(:.*)?"}[5m]) or (up{job="node-exporter", instance=~"${node}(:.*)?"} * 0)`,
    tx: `rate(node_network_transmit_drop_total{instance=~"${node}(:.*)?"}[5m]) or (up{job="node-exporter", instance=~"${node}(:.*)?"} * 0)`
  }),

  // F. FILESYSTEM SATURATION
  DISK_SPACE_USED: (node: string) => 
    `1 - (node_filesystem_avail_bytes{instance=~"${node}(:.*)?", mountpoint=~"/|/data" } / node_filesystem_size_bytes{instance=~"${node}(:.*)?", mountpoint=~"/|/data"})`,
  
  INODE_USED: (node: string) => 
    `1 - (node_filesystem_files_free{instance=~"${node}(:.*)?", mountpoint=~"/|/data" } / node_filesystem_files{instance=~"${node}(:.*)?", mountpoint=~"/|/data"})`,

  // G. LOAD AVERAGE RATIO
  LOAD_AVERAGE_RATIO: (node: string) => 
    `(node_load1{instance=~"${node}(:.*)?"} / count(node_cpu_seconds_total{instance=~"${node}(:.*)?", mode="idle"})) or (up{job="node-exporter", instance=~"${node}(:.*)?"} * 0)`,

  // H. CONTAINER UPTIME
  CONTAINER_UPTIME: (appId: string, appName: string, node: string) => 
    `(time() - container_start_time_seconds{container_label_com_monetique_app_id="${appId}", instance=~"${node}(:.*)?"}) or (time() - container_start_time_seconds{name=~".*${appName}.*", instance=~"${node}(:.*)?"})`,

  // I. CPU USAGE TREND (Stacked Area)
  CPU_USAGE_STACKED: (appId: string, appName: string, node: string) => 
    `(rate(container_cpu_usage_seconds_total{container_label_com_monetique_app_id="${appId}", instance=~"${node}(:.*)?"}[5m]) * 100 or rate(container_cpu_usage_seconds_total{name=~".*${appName}.*", instance=~"${node}(:.*)?"}[5m]) * 100) or (up{job="cadvisor", instance=~"${node}(:.*)?"} * 0)`,

  // J. NETWORK THROUGHPUT
  NETWORK_THROUGHPUT: (appId: string, appName: string, node: string) => ({
    rx: `(rate(container_network_receive_bytes_total{container_label_com_monetique_app_id="${appId}", instance=~"${node}(:.*)?"}[5m]) or rate(container_network_receive_bytes_total{name=~".*${appName}.*", instance=~"${node}(:.*)?"}[5m])) or (up{job="cadvisor", instance=~"${node}(:.*)?"} * 0)`,
    tx: `(rate(container_network_transmit_bytes_total{container_label_com_monetique_app_id="${appId}", instance=~"${node}(:.*)?"}[5m]) or rate(container_network_transmit_bytes_total{name=~".*${appName}.*", instance=~"${node}(:.*)?"}[5m])) or (up{job="cadvisor", instance=~"${node}(:.*)?"} * 0)`
  }),

  // K. NODE INFO
  NODE_INFO: (node: string) => 
    `node_uname_info{instance=~"${node}(:.*)?"}`,
  
  NODE_RESOURCES: (node: string) => ({
    cpu_cores: `count(node_cpu_seconds_total{instance=~"${node}(:.*)?", mode="idle"})`,
    memory_total: `node_memory_MemTotal_bytes{instance=~"${node}(:.*)?"}`,
    memory_used: `node_memory_MemTotal_bytes{instance=~"${node}(:.*)?"} - node_memory_MemAvailable_bytes{instance=~"${node}(:.*)?"}`
  })
};
