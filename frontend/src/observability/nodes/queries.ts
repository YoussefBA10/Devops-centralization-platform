import * as prometheus from '../../services/prometheusService';
import * as api from '../../services/api';

// Helper to strip port from instance name (e.g. "192.168.1.100:9100" -> "192.168.1.100")
export const getCleanNodeIp = (node: string): string => {
  if (!node) return '';
  return node.split(':')[0];
};

export const QUERIES = {
  // Section 1: Summary Stats
  NODE_STATUS: 'NODE_STATUS',
  UPTIME: 'UPTIME',
  CPU_USAGE: 'CPU_USAGE',
  MEMORY_USED_PCT: 'MEMORY_USED_PCT',
  DISK_USED_PCT: 'DISK_USED_PCT',
  LOAD_AVERAGE: 'LOAD_AVERAGE',
  ICMP_LATENCY: 'ICMP_LATENCY',
  NODE_UNAME: 'NODE_UNAME',

  // Section 2: CPU Analysis
  CPU_USAGE_MODE: 'CPU_USAGE_MODE',
  CPU_USAGE_MODES_ALL: 'CPU_USAGE_MODES_ALL',
  CPU_STEAL: 'CPU_STEAL',
  LOAD_AVG_3LINE: 'LOAD_AVG_3LINE',
  CPU_PSI: 'CPU_PSI',
  CPU_CORES_COUNT: 'CPU_CORES_COUNT',

  // Section 3: Memory Analysis
  MEM_BREAKDOWN: {
    Used: 'MEM_USED',
    Cached: 'MEM_CACHED',
    Buffers: 'MEM_BUFFERS',
    Free: 'MEM_FREE'
  },
  SWAP_USED_PCT: 'SWAP_USED_PCT',
  SWAP_TOTAL: 'SWAP_TOTAL',
  OOM_KILLS: 'OOM_KILLS',
  MEM_PSI: 'MEM_PSI',

  // Section 4: Disk & Storage
  DISK_SPACE_PER_MOUNT: 'DISK_SPACE_PER_MOUNT',
  DISK_SPACE_MOUNT_DETAILS: 'DISK_SPACE_MOUNT_DETAILS',
  DISK_SPACE_TOTAL_MOUNT: 'DISK_SPACE_TOTAL_MOUNT',
  INODE_USED_PER_MOUNT: 'INODE_USED_PER_MOUNT',
  DISK_THROUGHPUT_READ: 'DISK_THROUGHPUT_READ',
  DISK_THROUGHPUT_WRITE: 'DISK_THROUGHPUT_WRITE',
  DISK_IO_UTIL: 'DISK_IO_UTIL',
  DISK_LATENCY_READ: 'DISK_LATENCY_READ',
  DISK_LATENCY_WRITE: 'DISK_LATENCY_WRITE',

  // Section 5: Network Health
  NET_THROUGHPUT_RX: 'NET_THROUGHPUT_RX',
  NET_THROUGHPUT_TX: 'NET_THROUGHPUT_TX',
  NET_DROP_RX: 'NET_DROP_RX',
  NET_DROP_TX: 'NET_DROP_TX',
  NET_ERR_RX: 'NET_ERR_RX',
  NET_ERR_TX: 'NET_ERR_TX',
  NET_TCP_TW: 'NET_TCP_TW',
  NET_TCP_INUSE: 'NET_TCP_INUSE',
  NET_TCP_ALLOC: 'NET_TCP_ALLOC',
  CONNTRACK_UTIL: 'CONNTRACK_UTIL',

  // Section 6: Blackbox Reachability
  BLACKBOX_ICMP_SUCCESS: 'BLACKBOX_ICMP_SUCCESS',
  BLACKBOX_ICMP_DURATION: 'BLACKBOX_ICMP_DURATION',
  BLACKBOX_TCP_SUCCESS: 'BLACKBOX_TCP_SUCCESS',
  BLACKBOX_TCP_DURATION: 'BLACKBOX_TCP_DURATION',
  SSL_CERT_EXPIRY: 'SSL_CERT_EXPIRY',

  // Section 7: System Signals
  FILE_FD_USED_PCT: 'FILE_FD_USED_PCT',
  PROCESSES_RUNNING: 'PROCESSES_RUNNING',
  PROCESSES_BLOCKED: 'PROCESSES_BLOCKED',
  ENTROPY_POOL: 'ENTROPY_POOL',
  HW_TEMP: 'HW_TEMP',

  // Section 9: Incidents
  NODE_ACTIVE_ALERTS: 'NODE_ACTIVE_ALERTS',
  NODE_ALERTS_HISTORY: 'NODE_ALERTS_HISTORY'
};

// Derive disk devices for the node selector dropdown
export async function deriveDisks(instance: string): Promise<string[]> {
  try {
    const result = await prometheus.queryInstantByKey('DERIVE_DISKS', { node: instance });
    if (!result || result.length === 0) return ['sda'];
    const devices = result
      .map(r => r.metric.device)
      .filter(Boolean)
      .filter(d => !d.match(/^(loop|ram|dm-|nbd|sr)\d+/));
    return devices.length > 0 ? Array.from(new Set(devices)) : ['sda'];
  } catch (error) {
    console.error('Failed to derive disks:', error);
    return ['sda'];
  }
}

// Derive network interfaces for the node selector dropdown
export async function deriveInterfaces(instance: string): Promise<string[]> {
  try {
    const result = await prometheus.queryInstantByKey('DERIVE_INTERFACES', { node: instance });
    if (!result || result.length === 0) return ['eth0'];
    const interfaces = result
      .map(r => r.metric.device)
      .filter(Boolean)
      .filter(i => !i.match(/^(lo|docker0|veth|br-|bond|dummy|tun|tap|ovs)/));
    return interfaces.length > 0 ? Array.from(new Set(interfaces)) : ['eth0'];
  } catch (error) {
    console.error('Failed to derive network interfaces:', error);
    return ['eth0'];
  }
}

// Derive filesystem mounts for the mount selector dropdown
export async function deriveMounts(instance: string): Promise<string[]> {
  try {
    const result = await prometheus.queryInstantByKey('DERIVE_MOUNTS', { node: instance });
    if (!result || result.length === 0) return ['/'];
    const mounts = result
      .map(r => r.metric.mountpoint)
      .filter(Boolean);
    return mounts.length > 0 ? Array.from(new Set(mounts)) : ['/'];
  } catch (error) {
    console.error('Failed to derive mounts:', error);
    return ['/'];
  }
}

// Fetch Prometheus alerting rules from API
export async function fetchPrometheusRules(_prometheusUrl?: string): Promise<any[]> {
  try {
    const res = await api.getPrometheusRules();
    return res.data?.data?.groups || [];
  } catch (error) {
    console.error('Failed to fetch Prometheus rules:', error);
    return [];
  }
}

// Helper to check rules
export async function fetchRulesFromBackend(): Promise<any[]> {
  return fetchPrometheusRules();
}

export interface AlertTransition {
  alertname: string;
  labels: Record<string, string>;
  firedAt: string;
  resolvedAt: string;
  duration: string;
  active: boolean;
  severity: string;
}

// Parse alert transitions from query_range result of ALERTS{instance="xxx"}
export function parseAlertTransitions(matrixResult: any[]): AlertTransition[] {
  if (!matrixResult || !Array.isArray(matrixResult)) return [];

  const transitions: AlertTransition[] = [];

  for (const series of matrixResult) {
    const { metric, values } = series;
    const alertname = metric.alertname || 'UnknownAlert';
    const severity = metric.severity || 'warning';

    // Filter out internal labels
    const labels: Record<string, string> = {};
    for (const [k, v] of Object.entries(metric)) {
      if (!['__name__', 'alertstate', 'alertname', 'severity'].includes(k)) {
        labels[k] = v as string;
      }
    }

    let isFiring = false;
    let firedTimestamp: number | null = null;

    for (let i = 0; i < values.length; i++) {
      const [ts, valStr] = values[i];
      const val = parseFloat(valStr);

      if (val === 1 && !isFiring) {
        // Transition: 0 -> 1 (Fired)
        isFiring = true;
        firedTimestamp = ts;
      } else if (val === 0 && isFiring) {
        // Transition: 1 -> 0 (Resolved)
        isFiring = false;
        if (firedTimestamp !== null) {
          const durationSec = ts - firedTimestamp;
          transitions.push({
            alertname,
            labels,
            firedAt: new Date(firedTimestamp * 1000).toISOString(),
            resolvedAt: new Date(ts * 1000).toISOString(),
            duration: formatDuration(durationSec),
            active: false,
            severity
          });
          firedTimestamp = null;
        }
      }
    }

    // If still firing at the end of the range
    if (isFiring && firedTimestamp !== null) {
      const lastTs = values[values.length - 1][0];
      const durationSec = lastTs - firedTimestamp;
      transitions.push({
        alertname,
        labels,
        firedAt: new Date(firedTimestamp * 1000).toISOString(),
        resolvedAt: 'Still firing',
        duration: formatDuration(durationSec),
        active: true,
        severity
      });
    }
  }

  // Sort transitions by firedAt descending
  return transitions.sort((a, b) => new Date(b.firedAt).getTime() - new Date(a.firedAt).getTime());
}

function formatDuration(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Merges multiple Prometheus metric series into a single array of objects keyed by timestamp
export function combineSeries(results: any[], labelKey: string = 'mode'): any[] {
  if (!results || !Array.isArray(results)) return [];
  const map: Record<number, Record<string, number>> = {};
  
  results.forEach(series => {
    const key = series.metric[labelKey] || 'value';
    if (!series.values || !Array.isArray(series.values)) return;
    
    series.values.forEach(([ts, val]: [number, string]) => {
      const timestampMs = ts * 1000;
      if (!map[timestampMs]) {
        map[timestampMs] = {};
      }
      map[timestampMs][key] = parseFloat(val) || 0;
    });
  });

  return Object.entries(map).map(([timestamp, values]) => ({
    timestamp: parseInt(timestamp),
    ...values
  })).sort((a, b) => a.timestamp - b.timestamp);
}
