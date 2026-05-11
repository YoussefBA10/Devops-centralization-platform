/**
 * PromQL Query Templates for Monetique Eye Enterprise Observability
 *
 * Rewritten based on actual Prometheus label discovery:
 *
 * REAL LABELS ON YOUR CONTAINERS (from cAdvisor):
 *   - name="backend"                                          ← primary container selector
 *   - container_label_com_docker_compose_service="backend"   ← compose service name
 *   - container_label_com_docker_compose_project="vmpipe"    ← compose project
 *   - node_id="1"                                            ← node selector
 *   - instance="cadvisor:8080"                               ← cAdvisor instance
 *   - job="cadvisor"
 *   - id=~"/docker/.*"                                       ← REQUIRED to exclude systemd slices
 *
 * WHAT DOES NOT EXIST ON YOUR SETUP:
 *   - container_label_com_monetique_app_id  → removed from all queries
 *   - name label on systemd slices          → filtered out with id=~"/docker/.*"
 *
 * OOM EVENTS:
 *   - container_oom_events_total always returns 0 on this cAdvisor version/build
 *   - Confirmed by live test: OOMKilled=true but metric stayed 0
 *   - node_vmstat_oom_kill{node_id} is the ONLY working OOM metric → used as primary
 *   - Note: node_vmstat_oom_kill is node-wide, not per-container
 *
 * RESTARTS:
 *   - container_start_time_seconds matched by name + node_id + id=~"/docker/.*"
 *   - id filter is mandatory — without it systemd slice entries pollute results
 *
 * Function signature unchanged — no call-site modifications needed.
 * appId parameter retained for API compatibility but not used in queries.
 */
export const QUERIES = {

  // ─── A. CPU THROTTLING (%) ───────────────────────────────────────────────
  // Correct cAdvisor CFS metrics (not container_cpu_throttled_seconds_total).
  // id=~"/docker/.*" excludes systemd slices from all cAdvisor queries.
  CPU_THROTTLING: (appId: string, appName: string, nodeId: string, node: string) =>
    `(
      rate(container_cpu_cfs_throttled_seconds_total{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m])
      / rate(container_cpu_cfs_periods_total{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m])
      * 100
    )
    or
    (
      rate(container_cpu_cfs_throttled_seconds_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m])
      / rate(container_cpu_cfs_periods_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m])
      * 100
    )
    or
    (
      rate(container_cpu_cfs_throttled_seconds_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", instance=~"${node}(:.*)?", id=~"/docker/.*"}[5m])
      / rate(container_cpu_cfs_periods_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", instance=~"${node}(:.*)?", id=~"/docker/.*"}[5m])
      * 100
    )
    or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,


  // ─── B. CONTAINER RESTARTS ───────────────────────────────────────────────
  // id=~"/docker/.*" is mandatory — systemd slice entries have start_time too
  // and would show as false restarts without this filter.
  // increase() on start_time counts upward jumps = actual container restarts.
  CONTAINER_RESTARTS: (appId: string, appName: string, nodeId: string, node: string) =>
    `(
      increase(container_start_time_seconds{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[10m])
    )
    or
    (
      increase(container_start_time_seconds{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[10m])
    )
    or
    (
      increase(container_start_time_seconds{container_label_com_docker_compose_service=~"(?i).*${appName}.*", instance=~"${node}(:.*)?", id=~"/docker/.*"}[10m])
    )
    or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,


  // ─── C. MEMORY PRESSURE (%) ──────────────────────────────────────────────
  // First arm:  limit-based — accurate when Docker --memory limit is set.
  // Second arm: compose service label match with correct on() vector matching.
  // Third arm:  node total RAM fallback — when no container memory limit exists.
  //             on(node_id) group_left() required — container and node metrics
  //             have different label sets and can't be divided directly.
  MEMORY_PRESSURE: (appId: string, appName: string, nodeId: string, node: string) =>
    `(
      (
        container_memory_working_set_bytes{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}
        / (container_spec_memory_limit_bytes{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"} > 0)
      ) * 100
    )
    or
    (
      (
        container_memory_working_set_bytes{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}
        / on(container_label_com_docker_compose_service, node_id)
          (container_spec_memory_limit_bytes{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"} > 0)
      ) * 100
    )
    or
    (
      (
        container_memory_working_set_bytes{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}
        / on(node_id) group_left()
          node_memory_MemTotal_bytes{node_id="${nodeId}"}
      ) * 100
    )
    or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,


  // ─── D. OOM KILL EVENTS ──────────────────────────────────────────────────
  // container_oom_events_total is broken on this cAdvisor build — confirmed
  // by live test (docker inspect showed OOMKilled=true, metric stayed at 0).
  // node_vmstat_oom_kill is the only reliable OOM signal on this setup.
  // WARNING: this is node-wide — any process OOM on the node increments it,
  // not just your container. Label it accordingly in the dashboard UI.
  OOM_EVENTS: (appId: string, appName: string, nodeId: string, node: string) =>
    `(
      increase(node_vmstat_oom_kill{node_id="${nodeId}"}[10m])
    )
    or
    (
      increase(node_vmstat_oom_kill{instance=~"${node}(:.*)?"}[10m])
    )
    or (up{job="node-exporter", node_id="${nodeId}"} * 0)`,


  // ─── E. NETWORK PACKET DROPS (host level) ────────────────────────────────
  // node_id="1" confirmed working from live Prometheus queries.
  // instance="node-exporter:9100" confirmed as the central-node fallback.
  NETWORK_DROPS: (nodeId: string, node: string) => ({
    rx: `(
      rate(node_network_receive_drop_total{node_id="${nodeId}", device!="lo"}[5m])
    )
    or
    (
      rate(node_network_receive_drop_total{instance=~"${node}(:.*)?", device!="lo"}[5m])
    )
    or (up{job="node-exporter", node_id="${nodeId}"} * 0)`,

    tx: `(
      rate(node_network_transmit_drop_total{node_id="${nodeId}", device!="lo"}[5m])
    )
    or
    (
      rate(node_network_transmit_drop_total{instance=~"${node}(:.*)?", device!="lo"}[5m])
    )
    or (up{job="node-exporter", node_id="${nodeId}"} * 0)`,
  }),


  // ─── F. FILESYSTEM SATURATION ────────────────────────────────────────────
  // Returns % (0–100). node_filesystem_avail_bytes accounts for reserved blocks
  // (unlike node_filesystem_free_bytes which includes root-only reserved space).
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
  // Values > 1.0 indicate CPU saturation (load higher than available cores).
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
  // id=~"/docker/.*" critical — systemd slices also have start_time and would
  // show false uptime values for non-container processes.
  // Zero-guard prevents duplicate series when multiple arms resolve simultaneously.
  CONTAINER_UPTIME: (appId: string, appName: string, nodeId: string, node: string) =>
    `(
      time() - container_start_time_seconds{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}
    )
    or
    (
      time() - container_start_time_seconds{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}
    )
    or
    (
      time() - container_start_time_seconds{container_label_com_docker_compose_service=~"(?i).*${appName}.*", instance=~"${node}(:.*)?", id=~"/docker/.*"}
    )
    or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,


  // ─── I. CPU USAGE TREND (stacked area) ───────────────────────────────────
  // Values > 100% are normal for multi-core containers (200% = 2 cores busy).
  // Set dashboard panel unit to "percent (0–∞)" not "percent (0–100)".
  CPU_USAGE_STACKED: (appId: string, appName: string, nodeId: string, node: string) =>
    `(
      rate(container_cpu_usage_seconds_total{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m]) * 100
    )
    or
    (
      rate(container_cpu_usage_seconds_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m]) * 100
    )
    or
    (
      rate(container_cpu_usage_seconds_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", instance=~"${node}(:.*)?", id=~"/docker/.*"}[5m]) * 100
    )
    or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,


  // ─── J. NETWORK THROUGHPUT ───────────────────────────────────────────────
  // Results in bytes/sec — set dashboard panel unit to bytes/sec or bps.
  NETWORK_THROUGHPUT: (appId: string, appName: string, nodeId: string, node: string) => ({
    rx: `(
      rate(container_network_receive_bytes_total{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m])
    )
    or
    (
      rate(container_network_receive_bytes_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m])
    )
    or
    (
      rate(container_network_receive_bytes_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", instance=~"${node}(:.*)?", id=~"/docker/.*"}[5m])
    )
    or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,

    tx: `(
      rate(container_network_transmit_bytes_total{name=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m])
    )
    or
    (
      rate(container_network_transmit_bytes_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", node_id="${nodeId}", id=~"/docker/.*"}[5m])
    )
    or
    (
      rate(container_network_transmit_bytes_total{container_label_com_docker_compose_service=~"(?i).*${appName}.*", instance=~"${node}(:.*)?", id=~"/docker/.*"}[5m])
    )
    or (up{job="cadvisor", node_id="${nodeId}"} * 0)`,
  }),


  // ─── K. NODE INFO & RESOURCES ────────────────────────────────────────────
  NODE_INFO: (nodeId: string, node: string) =>
    `node_uname_info{node_id="${nodeId}"}
    or node_uname_info{instance=~"${node}(:.*)?"}`,

  // memory_used: both arms use matching labels on both sides of the subtraction.
  // Previous version mixed node_id on right with instance on left → silent no-data.
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