import React, { useState, useEffect } from 'react';
import { Activity, Clock, Cpu, Zap, HardDrive, Terminal } from 'lucide-react';
import * as prometheus from '../../../services/prometheusService';
import { getCleanNodeIp } from '../queries';
import { StatCard } from '../components/StatCard';

interface NodeSummaryProps {
  selectedNode: string;
  triggerRefresh: number;
}

export const NodeSummary: React.FC<NodeSummaryProps> = ({ selectedNode, triggerRefresh }) => {
  const [data, setData] = useState<any>({
    status: 'UNKNOWN',
    uptime: 'N/A',
    cpu: 0,
    memory: 0,
    disk: 0,
    load: 0,
    latency: 'N/A',
    hostname: 'N/A',
    os: 'N/A',
    incidentsCount: 0
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedNode) return;
      setLoading(true);

      try {
        const cleanIp = getCleanNodeIp(selectedNode);
        const [
          statusRes,
          uptimeRes,
          cpuRes,
          memRes,
          diskRes,
          loadRes,
          latencyRes,
          unameRes,
          alertsRes
        ] = await Promise.all([
          prometheus.queryInstantByKey('NODE_STATUS', { node_ip: cleanIp }),
          prometheus.queryInstantByKey('UPTIME', { node: selectedNode }),
          prometheus.queryInstantByKey('CPU_USAGE', { node: selectedNode }),
          prometheus.queryInstantByKey('MEMORY_USED_PCT', { node: selectedNode }),
          prometheus.queryInstantByKey('DISK_USED_PCT', { node: selectedNode, mount: '/' }),
          prometheus.queryInstantByKey('LOAD_AVERAGE', { node: selectedNode }),
          prometheus.queryInstantByKey('ICMP_LATENCY', { node_ip: cleanIp }),
          prometheus.queryInstantByKey('NODE_UNAME', { node: selectedNode }),
          prometheus.queryInstantByKey('NODE_ACTIVE_ALERTS', { node_ip: cleanIp })
        ]);

        // 1. Status
        let status = 'UNKNOWN';
        if (statusRes && statusRes.length > 0) {
          const val = parseFloat(statusRes[0].value[1]);
          status = val === 1 ? 'ONLINE' : 'UNREACHABLE';
        }

        // 2. Uptime
        let uptime = 'N/A';
        if (uptimeRes && uptimeRes.length > 0) {
          const sec = parseFloat(uptimeRes[0].value[1]);
          if (isFinite(sec)) {
            const d = Math.floor(sec / (3600 * 24));
            const h = Math.floor((sec % (3600 * 24)) / 3600);
            const m = Math.floor((sec % 3600) / 60);
            uptime = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
          }
        }

        // 3. CPU
        const cpu = cpuRes && cpuRes.length > 0 ? parseFloat(cpuRes[0].value[1]) : 0;

        // 4. Memory
        const memory = memRes && memRes.length > 0 ? parseFloat(memRes[0].value[1]) : 0;

        // 5. Disk
        const disk = diskRes && diskRes.length > 0 ? parseFloat(diskRes[0].value[1]) : 0;

        // 6. Load Average
        const load = loadRes && loadRes.length > 0 ? parseFloat(loadRes[0].value[1]) : 0;

        // 7. Latency
        let latency = 'UNKNOWN';
        if (status === 'ONLINE' && latencyRes && latencyRes.length > 0) {
          const duration = parseFloat(latencyRes[0].value[1]);
          latency = `${(duration * 1000).toFixed(1)}ms`;
        }

        // 8. Hostname / OS
        let hostname = selectedNode;
        let os = 'N/A';
        if (unameRes && unameRes.length > 0) {
          const m = unameRes[0].metric;
          hostname = m.nodename || selectedNode;
          os = `${m.sysname || ''} ${m.release || ''}`;
        }

        // 9. Incidents
        const incidentsCount = alertsRes ? alertsRes.length : 0;

        setData({
          status,
          uptime,
          cpu,
          memory,
          disk,
          load,
          latency,
          hostname,
          os,
          incidentsCount
        });
      } catch (error) {
        console.error('Failed to load node summary stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedNode, triggerRefresh]);

  const getStatusColor = () => {
    if (data.status === 'ONLINE') return 'var(--color-healthy)';
    if (data.status === 'UNREACHABLE') return 'var(--color-critical)';
    return 'var(--color-unknown)';
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Status */}
      <StatCard
        title="Node Status"
        value={data.status}
        icon={<Activity className="w-4 h-4" />}
        color={getStatusColor()}
        loading={loading}
        statusColor={data.status === 'ONLINE' ? 'healthy' : data.status === 'UNREACHABLE' ? 'critical' : 'unknown'}
      />

      {/* 2. Uptime */}
      <StatCard
        title="Uptime"
        value={data.uptime}
        icon={<Clock className="w-4 h-4" />}
        color="var(--color-primary)"
        loading={loading}
      />

      {/* 3. CPU */}
      <StatCard
        title="CPU Usage"
        value={data.cpu.toFixed(1)}
        unit="%"
        icon={<Cpu className="w-4 h-4" />}
        color={data.cpu > 80 ? 'var(--color-critical)' : data.cpu > 60 ? 'var(--color-warning)' : 'var(--color-healthy)'}
        loading={loading}
        statusColor={data.cpu > 80 ? 'critical' : data.cpu > 60 ? 'warning' : 'healthy'}
      />

      {/* 4. Memory */}
      <StatCard
        title="Memory Used"
        value={data.memory.toFixed(1)}
        unit="%"
        icon={<Zap className="w-4 h-4" />}
        color={data.memory > 85 ? 'var(--color-critical)' : data.memory > 70 ? 'var(--color-warning)' : 'var(--color-healthy)'}
        loading={loading}
        statusColor={data.memory > 85 ? 'critical' : data.memory > 70 ? 'warning' : 'healthy'}
      />

      {/* 5. Disk */}
      <StatCard
        title="Disk Used"
        value={data.disk.toFixed(1)}
        unit="%"
        icon={<HardDrive className="w-4 h-4" />}
        color={data.disk > 85 ? 'var(--color-critical)' : data.disk > 70 ? 'var(--color-warning)' : 'var(--color-healthy)'}
        loading={loading}
        statusColor={data.disk > 85 ? 'critical' : data.disk > 70 ? 'warning' : 'healthy'}
      />

      {/* 6. Load Average */}
      <StatCard
        title="Load Avg (1m)"
        value={data.load.toFixed(2)}
        icon={<Terminal className="w-4 h-4" />}
        color={data.load > 1.0 ? 'var(--color-critical)' : data.load > 0.7 ? 'var(--color-warning)' : 'var(--color-healthy)'}
        loading={loading}
        statusColor={data.load > 1.0 ? 'critical' : data.load > 0.7 ? 'warning' : 'healthy'}
      />

      {/* 7. HTTP Latency */}
      <StatCard
        title="HTTP Latency"
        value={data.latency}
        icon={<Activity className="w-4 h-4" />}
        color="var(--color-primary)"
        loading={loading}
      />

      {/* 8. Hostname / OS */}
      <div className="bg-[#1a1d27] shadow-xl border border-white/5 p-4 rounded-xl flex flex-col justify-center min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-[#a1a1aa] mb-1 truncate">Host / OS</p>
        {loading ? (
          <div className="space-y-1">
            <div className="h-4 w-20 bg-white/5 animate-pulse rounded" />
            <div className="h-3 w-28 bg-white/5 animate-pulse rounded" />
          </div>
        ) : (
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate font-mono">{data.hostname}</p>
            <p className="text-[9px] text-[#a1a1aa] truncate mt-0.5">{data.os}</p>
          </div>
        )}
      </div>
    </div>
  );
};
export default NodeSummary;

