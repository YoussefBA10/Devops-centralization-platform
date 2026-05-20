package com.monetique.eye.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class NodeMonitoringService {

    private final PrometheusClient prometheusClient;

    private static final Map<String, String> QUERIES = new HashMap<>();

    static {
        // Section 1: Summary Stats
        QUERIES.put("NODE_STATUS", "up{job=\"node-exporter\", instance=~\"$node_ip(:.*)?\"}");
        QUERIES.put("UPTIME", "time() - node_boot_time_seconds{instance=~\"$node(:.*)?\"}");
        QUERIES.put("CPU_USAGE", "100 - (avg by(instance)(rate(node_cpu_seconds_total{mode=\"idle\",instance=~\"$node(:.*)?\"}[5m])) * 100)");
        QUERIES.put("MEMORY_USED_PCT", "(1 - node_memory_MemAvailable_bytes{instance=~\"$node(:.*)?\"} / node_memory_MemTotal_bytes{instance=~\"$node(:.*)?\"}) * 100");
        QUERIES.put("DISK_USED_PCT", "(1 - node_filesystem_avail_bytes{instance=~\"$node(:.*)?\",mountpoint=\"$mount\"} / node_filesystem_size_bytes{instance=~\"$node(:.*)?\",mountpoint=\"$mount\"}) * 100");
        QUERIES.put("LOAD_AVERAGE", "node_load1{instance=~\"$node(:.*)?\"} / count(node_cpu_seconds_total{mode=\"idle\",instance=~\"$node(:.*)?\"})");
        QUERIES.put("ICMP_LATENCY", "probe_duration_seconds{probe_module=\"http_2xx\"} * on(nodename) group_left() (node_uname_info{instance=~\"$node(:.*)?\"} * 0 + 1)");
        QUERIES.put("NODE_UNAME", "node_uname_info{instance=~\"$node(:.*)?\"}");

        // Section 2: CPU Analysis
        QUERIES.put("CPU_USAGE_MODE", "rate(node_cpu_seconds_total{instance=~\"$node(:.*)?\", mode=\"$mode\"}[5m]) * 100");
        QUERIES.put("CPU_USAGE_MODES_ALL", "avg by (mode) (rate(node_cpu_seconds_total{instance=~\"$node(:.*)?\", mode=~\"user|system|iowait|steal|softirq\"}[5m])) * 100");
        QUERIES.put("CPU_STEAL", "avg(rate(node_cpu_seconds_total{instance=~\"$node(:.*)?\",mode=\"steal\"}[5m])) * 100");
        QUERIES.put("LOAD_AVG_3LINE", "node_load$val{instance=~\"$node(:.*)?\"}");
        QUERIES.put("CPU_PSI", "rate(node_pressure_cpu_waiting_seconds_total{instance=~\"$node(:.*)?\"}[5m]) * 100");
        QUERIES.put("CPU_CORES_COUNT", "count(node_cpu_seconds_total{instance=~\"$node(:.*)?\", mode=\"idle\"})");

        // Section 3: Memory Analysis
        QUERIES.put("MEM_USED", "node_memory_MemTotal_bytes{instance=~\"$node(:.*)?\"} - node_memory_MemAvailable_bytes{instance=~\"$node(:.*)?\"}");
        QUERIES.put("MEM_CACHED", "node_memory_Cached_bytes{instance=~\"$node(:.*)?\"}");
        QUERIES.put("MEM_BUFFERS", "node_memory_Buffers_bytes{instance=~\"$node(:.*)?\"}");
        QUERIES.put("MEM_FREE", "node_memory_MemFree_bytes{instance=~\"$node(:.*)?\"}");
        QUERIES.put("SWAP_USED_PCT", "(node_memory_SwapTotal_bytes{instance=~\"$node(:.*)?\"} - node_memory_SwapFree_bytes{instance=~\"$node(:.*)?\"}) / node_memory_SwapTotal_bytes{instance=~\"$node(:.*)?\"} * 100");
        QUERIES.put("SWAP_TOTAL", "node_memory_SwapTotal_bytes{instance=~\"$node(:.*)?\"}");
        QUERIES.put("OOM_KILLS", "increase(node_vmstat_oom_kill{instance=~\"$node(:.*)?\"}[$range])");
        QUERIES.put("MEM_PSI", "rate(node_pressure_memory_waiting_seconds_total{instance=~\"$node(:.*)?\"}[5m]) * 100");

        // Section 4: Disk & Storage
        QUERIES.put("DISK_SPACE_PER_MOUNT", "(1 - node_filesystem_avail_bytes{instance=~\"$node(:.*)?\",fstype!~\"tmpfs|overlay|devtmpfs\"} / node_filesystem_size_bytes{instance=~\"$node(:.*)?\",fstype!~\"tmpfs|overlay|devtmpfs\"}) * 100");
        QUERIES.put("DISK_SPACE_MOUNT_DETAILS", "node_filesystem_avail_bytes{instance=~\"$node(:.*)?\",fstype!~\"tmpfs|overlay|devtmpfs\"}");
        QUERIES.put("DISK_SPACE_TOTAL_MOUNT", "node_filesystem_size_bytes{instance=~\"$node(:.*)?\",fstype!~\"tmpfs|overlay|devtmpfs\"}");
        QUERIES.put("DISK_INODES_TOTAL", "node_filesystem_files{instance=~\"$node(:.*)?\",fstype!~\"tmpfs|overlay|devtmpfs\"}");
        QUERIES.put("DISK_INODES_FREE", "node_filesystem_files_free{instance=~\"$node(:.*)?\",fstype!~\"tmpfs|overlay|devtmpfs\"}");
        QUERIES.put("DISK_INODE_USED_PCT", "(1 - node_filesystem_files_free{instance=~\"$node(:.*)?\",mountpoint=\"$mount\"} / node_filesystem_files{instance=~\"$node(:.*)?\",mountpoint=\"$mount\"}) * 100");
        QUERIES.put("INODE_USED_PER_MOUNT", "(1 - node_filesystem_files_free{instance=~\"$node(:.*)?\",fstype!~\"tmpfs|overlay|devtmpfs\"} / node_filesystem_files{instance=~\"$node(:.*)?\",fstype!~\"tmpfs|overlay|devtmpfs\"}) * 100");
        QUERIES.put("DISK_THROUGHPUT_READ", "rate(node_disk_read_bytes_total{instance=~\"$node(:.*)?\", device=\"$disk\"}[5m])");
        QUERIES.put("DISK_THROUGHPUT_WRITE", "rate(node_disk_written_bytes_total{instance=~\"$node(:.*)?\", device=\"$disk\"}[5m])");
        QUERIES.put("DISK_IO_UTIL", "rate(node_disk_io_time_seconds_total{instance=~\"$node(:.*)?\", device=\"$disk\"}[5m]) * 100");
        QUERIES.put("DISK_LATENCY_READ", "rate(node_disk_read_time_seconds_total{instance=~\"$node(:.*)?\",device=\"$disk\"}[5m]) / rate(node_disk_reads_completed_total{instance=~\"$node(:.*)?\",device=\"$disk\"}[5m]) * 1000");
        QUERIES.put("DISK_LATENCY_WRITE", "rate(node_disk_write_time_seconds_total{instance=~\"$node(:.*)?\",device=\"$disk\"}[5m]) / rate(node_disk_writes_completed_total{instance=~\"$node(:.*)?\",device=\"$disk\"}[5m]) * 1000");

        // Section 5: Network Health
        QUERIES.put("NET_THROUGHPUT_RX", "rate(node_network_receive_bytes_total{instance=~\"$node(:.*)?\", device=\"$iface\"}[5m])");
        QUERIES.put("NET_THROUGHPUT_TX", "rate(node_network_transmit_bytes_total{instance=~\"$node(:.*)?\", device=\"$iface\"}[5m])");
        QUERIES.put("NET_DROP_RX", "rate(node_network_receive_drop_total{instance=~\"$node(:.*)?\", device=\"$iface\"}[5m])");
        QUERIES.put("NET_DROP_TX", "rate(node_network_transmit_drop_total{instance=~\"$node(:.*)?\", device=\"$iface\"}[5m])");
        QUERIES.put("NET_DROP_TOTAL", "sum(rate(node_network_receive_drop_total{instance=~\"$node(:.*)?\"}[5m])) + sum(rate(node_network_transmit_drop_total{instance=~\"$node(:.*)?\"}[5m]))");
        QUERIES.put("NET_ERR_RX", "rate(node_network_receive_errs_total{instance=~\"$node(:.*)?\", device=\"$iface\"}[5m])");
        QUERIES.put("NET_ERR_TX", "rate(node_network_transmit_errs_total{instance=~\"$node(:.*)?\", device=\"$iface\"}[5m])");
        QUERIES.put("NET_TCP_TW", "node_sockstat_TCP_tw{instance=~\"$node(:.*)?\"}");
        QUERIES.put("NET_TCP_INUSE", "node_sockstat_TCP_inuse{instance=~\"$node(:.*)?\"}");
        QUERIES.put("NET_TCP_ALLOC", "node_sockstat_TCP_alloc{instance=~\"$node(:.*)?\"}");
        QUERIES.put("CONNTRACK_UTIL", "node_nf_conntrack_entries{instance=~\"$node(:.*)?\"} / node_nf_conntrack_entries_limit{instance=~\"$node(:.*)?\"} * 100");

        // Section 6: Blackbox Reachability
        QUERIES.put("BLACKBOX_ICMP_SUCCESS", "probe_success{probe_module=\"http_2xx\", instance=~\".*$node_ip.*\"}");
        QUERIES.put("BLACKBOX_ICMP_DURATION", "probe_duration_seconds{probe_module=\"http_2xx\", instance=~\".*$node_ip.*\"} * 1000");
        QUERIES.put("BLACKBOX_TCP_SUCCESS", "probe_success{job=\"blackbox_tcp\", instance=~\"$node_ip:.*\"}");
        QUERIES.put("BLACKBOX_TCP_DURATION", "probe_duration_seconds{job=\"blackbox_tcp\", instance=~\"$node_ip:.*\"} * 1000");
        QUERIES.put("SSL_CERT_EXPIRY", "(probe_ssl_earliest_cert_expiry{instance=~\"$node_ip(:.*)?\"} - time()) / 86400");

        // Section 7: System Signals
        QUERIES.put("FILE_FD_USED_PCT", "node_filefd_allocated{instance=~\"$node(:.*)?\"} / node_filefd_maximum{instance=~\"$node(:.*)?\"} * 100");
        QUERIES.put("FILE_FD_ALLOCATED", "node_filefd_allocated{instance=~\"$node(:.*)?\"}");
        QUERIES.put("FILE_FD_MAXIMUM", "node_filefd_maximum{instance=~\"$node(:.*)?\"}");
        QUERIES.put("PROCESSES_RUNNING", "node_processes_running{instance=~\"$node(:.*)?\"}");
        QUERIES.put("PROCESSES_BLOCKED", "node_processes_blocked{instance=~\"$node(:.*)?\"}");
        QUERIES.put("ENTROPY_POOL", "node_entropy_available_bits{instance=~\"$node(:.*)?\"}");
        QUERIES.put("HW_TEMP", "node_hwmon_temp_celsius{instance=~\"$node(:.*)?\"}");

        // Section 9: Incidents
        QUERIES.put("NODE_ACTIVE_ALERTS", "ALERTS{instance=~\"$node_ip(:.*)?\", alertstate=\"firing\"}");
        QUERIES.put("NODE_ALERTS_HISTORY", "ALERTS{instance=~\"$node_ip(:.*)?\"}");

        // Dropdowns
        QUERIES.put("DERIVE_DISKS", "node_disk_io_time_seconds_total{instance=~\"$node(:.*)?\"}");
        QUERIES.put("DERIVE_INTERFACES", "node_network_receive_bytes_total{instance=~\"$node(:.*)?\"}");
        QUERIES.put("DERIVE_MOUNTS", "node_filesystem_size_bytes{instance=~\"$node(:.*)?\"}");
    }

    public Map<String, Object> queryNodeInstant(String key, Map<String, String> params) {
        String template = QUERIES.get(key);
        if (template == null) {
            log.error("Query template not found for key: {}", key);
            Map<String, Object> err = new HashMap<>();
            err.put("status", "error");
            err.put("error", "Query template not found for key: " + key);
            return err;
        }
        String resolvedQuery = resolveTemplate(template, params);
        return prometheusClient.proxyQuery(resolvedQuery);
    }

    public Map<String, Object> queryNodeRange(String key, String start, String end, String step, Map<String, String> params) {
        String template = QUERIES.get(key);
        if (template == null) {
            log.error("Query template not found for key: {}", key);
            Map<String, Object> err = new HashMap<>();
            err.put("status", "error");
            err.put("error", "Query template not found for key: " + key);
            return err;
        }
        String resolvedQuery = resolveTemplate(template, params);
        return prometheusClient.proxyQueryRange(resolvedQuery, start, end, step);
    }

    private String resolveTemplate(String template, Map<String, String> params) {
        String query = template;
        
        // Ensure default parameters to prevent unresolved tokens if missing
        Map<String, String> allParams = new HashMap<>();
        allParams.put("range", "10m");
        if (params != null) {
            allParams.putAll(params);
        }

        // Sort keys by length descending to replace longer placeholders like $node_ip before $node
        java.util.List<String> sortedKeys = new java.util.ArrayList<>(allParams.keySet());
        sortedKeys.sort((k1, k2) -> Integer.compare(k2.length(), k1.length()));

        for (String key : sortedKeys) {
            String val = allParams.get(key);
            if (val == null) {
                val = "";
            }
            String safeVal = val.replace("\\", "\\\\").replace("\"", "\\\"");
            query = query.replace("$" + key, safeVal);
        }
        return query;
    }
}
