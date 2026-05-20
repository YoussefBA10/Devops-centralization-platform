import React, { useState, useEffect } from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import * as prometheus from '../../../services/prometheusService';
import { combineSeries } from '../queries';
import { ThresholdLine } from '../components/ThresholdLine';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Select } from '../../../components/ui/Select';
import { format } from 'date-fns';

interface DiskStorageProps {
  selectedNode: string;
  selectedDisk: string;
  onChangeDisk: (disk: string) => void;
  disks: string[];
  timeRange: { start: number; end: number };
  triggerRefresh: number;
}

interface MountData {
  mountpoint: string;
  usedPercent: number;
  usedBytes: number;
  totalBytes: number;
  inodePercent: number;
}

export const DiskStorage: React.FC<DiskStorageProps> = ({
  selectedNode,
  selectedDisk,
  onChangeDisk,
  disks,
  timeRange,
  triggerRefresh
}) => {
  const [loading, setLoading] = useState(true);
  const [mountsData, setMountsData] = useState<MountData[]>([]);
  const [throughputData, setThroughputData] = useState<any[]>([]);
  const [ioUtilData, setIoUtilData] = useState<any[]>([]);
  const [latencyData, setLatencyData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedNode) return;
      setLoading(true);

      const { start, end } = timeRange;

      try {
        // 1. Fetch Mount Points Details (Instant query)
        const [sizeRes, availRes, inodesTotalRes, inodesFreeRes] = await Promise.all([
          prometheus.queryInstantByKey('DISK_SPACE_TOTAL_MOUNT', { node: selectedNode }),
          prometheus.queryInstantByKey('DISK_SPACE_MOUNT_DETAILS', { node: selectedNode }),
          prometheus.queryInstantByKey('DISK_INODES_TOTAL', { node: selectedNode }),
          prometheus.queryInstantByKey('DISK_INODES_FREE', { node: selectedNode })
        ]);

        const mountsMap: Record<string, Partial<MountData>> = {};

        sizeRes.forEach(r => {
          const m = r.metric.mountpoint;
          if (!m) return;
          mountsMap[m] = {
            mountpoint: m,
            totalBytes: parseFloat(r.value[1])
          };
        });

        availRes.forEach(r => {
          const m = r.metric.mountpoint;
          if (!m || !mountsMap[m]) return;
          const total = mountsMap[m].totalBytes || 0;
          const avail = parseFloat(r.value[1]);
          const used = total - avail;
          mountsMap[m].usedBytes = used;
          mountsMap[m].usedPercent = total > 0 ? (used / total) * 100 : 0;
        });

        // Inodes
        const inodeTotalMap: Record<string, number> = {};
        inodesTotalRes.forEach(r => {
          const m = r.metric.mountpoint;
          if (m) inodeTotalMap[m] = parseFloat(r.value[1]);
        });

        inodesFreeRes.forEach(r => {
          const m = r.metric.mountpoint;
          if (!m || !mountsMap[m]) return;
          const totalInodes = inodeTotalMap[m] || 0;
          const freeInodes = parseFloat(r.value[1]);
          const usedInodes = totalInodes - freeInodes;
          mountsMap[m].inodePercent = totalInodes > 0 ? (usedInodes / totalInodes) * 100 : 0;
        });

        const formattedMounts = Object.values(mountsMap).filter(m => m.mountpoint) as MountData[];
        setMountsData(formattedMounts.sort((a, b) => a.mountpoint.localeCompare(b.mountpoint)));

        // 2. Fetch Throughput, IO Util, and Latency for selected Disk
        const targetDisk = selectedDisk || (disks.length > 0 ? disks[0] : 'sda');

        const [readTpRes, writeTpRes, ioUtilRes, readLatRes, writeLatRes] = await Promise.all([
          prometheus.queryRangeByKey('DISK_THROUGHPUT_READ', start, end, undefined, { node: selectedNode, disk: targetDisk }),
          prometheus.queryRangeByKey('DISK_THROUGHPUT_WRITE', start, end, undefined, { node: selectedNode, disk: targetDisk }),
          prometheus.queryRangeByKey('DISK_IO_UTIL', start, end, undefined, { node: selectedNode, disk: targetDisk }),
          prometheus.queryRangeByKey('DISK_LATENCY_READ', start, end, undefined, { node: selectedNode, disk: targetDisk }),
          prometheus.queryRangeByKey('DISK_LATENCY_WRITE', start, end, undefined, { node: selectedNode, disk: targetDisk })
        ]);

        // Format throughput
        setThroughputData(combineSeries([
          ...(readTpRes.map(s => ({ ...s, metric: { op: 'read' } }))),
          ...(writeTpRes.map(s => ({ ...s, metric: { op: 'write' } })))
        ], 'op'));

        // Format IO Utilization
        setIoUtilData(prometheus.formatSeries(ioUtilRes));

        // Format Latency
        setLatencyData(combineSeries([
          ...(readLatRes.map(s => ({ ...s, metric: { op: 'read' } }))),
          ...(writeLatRes.map(s => ({ ...s, metric: { op: 'write' } })))
        ], 'op'));

      } catch (error) {
        console.error('Failed to load disk analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedNode, selectedDisk, disks, timeRange, triggerRefresh]);

  const formatTime = (tick: number) => {
    try {
      return format(new Date(tick), 'HH:mm');
    } catch {
      return '';
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatThroughput = (bytesPerSec: number) => {
    return `${formatBytes(bytesPerSec)}/s`;
  };

  const chartTheme = {
    grid: { stroke: 'rgba(255,255,255,0.05)', strokeDasharray: '3 3' },
    tooltip: {
      contentStyle: { backgroundColor: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: '8px' },
      labelStyle: { color: '#a1a1aa', fontWeight: 'bold', fontSize: '10px' }
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6">
        <Card className="bg-[#1a1d27] border-white/5 h-48 animate-pulse">
          <div />
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="bg-[#1a1d27] border-white/5 h-64 animate-pulse">
              <div />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Mount Points Details Table */}
      <Card className="bg-[#1a1d27] border-white/5 shadow-2xl overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">Filesystem Mount Points Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-medium">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-[#a1a1aa] text-[9px] uppercase tracking-widest">
                <th className="p-4 font-black">Mount Point</th>
                <th className="p-4 font-black">Disk Space Used %</th>
                <th className="p-4 font-black text-right">Used / Total Size</th>
                <th className="p-4 font-black">Inode Usage %</th>
              </tr>
            </thead>
            <tbody>
              {mountsData.map(mount => {
                const isSpaceWarn = mount.usedPercent > 80;
                const isSpaceCrit = mount.usedPercent > 90;
                const isInodeWarn = mount.inodePercent > 80;
                const isInodeCrit = mount.inodePercent > 95;

                return (
                  <tr key={mount.mountpoint} className="border-b border-white/5 hover:bg-white/[0.01]">
                    <td className="p-4 font-mono font-bold text-white truncate max-w-[200px]" title={mount.mountpoint}>
                      {mount.mountpoint}
                    </td>
                    <td className="p-4 w-1/3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              isSpaceCrit ? 'bg-rose-500' : isSpaceWarn ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(mount.usedPercent, 100)}%` }}
                          />
                        </div>
                        <span className={`font-mono font-bold w-12 text-right ${
                          isSpaceCrit ? 'text-rose-400' : isSpaceWarn ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {mount.usedPercent.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right font-mono text-[#a1a1aa] font-bold">
                      {formatBytes(mount.usedBytes)} / {formatBytes(mount.totalBytes)}
                    </td>
                    <td className="p-4 w-1/4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              isInodeCrit ? 'bg-rose-500' : isInodeWarn ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(mount.inodePercent, 100)}%` }}
                          />
                        </div>
                        <span className={`font-mono font-bold w-10 text-right ${
                          isInodeCrit ? 'text-rose-400' : isInodeWarn ? 'text-amber-400' : 'text-[#a1a1aa]'
                        }`}>
                          {mount.inodePercent.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Select Disk and Charts Grid */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black uppercase text-[#a1a1aa] tracking-widest">Active Disk Target:</label>
          <Select 
            value={selectedDisk} 
            onChange={(e) => onChangeDisk(e.target.value)}
            className="w-32 bg-black/40 border-white/5 text-xs h-8 font-bold"
          >
            {disks.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. Throughput */}
        <Card className="bg-[#1a1d27] border-white/5 shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">Disk Read / Write Throughput</CardTitle>
          </CardHeader>
          <CardContent className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={throughputData}>
                <CartesianGrid stroke={chartTheme.grid.stroke} strokeDasharray={chartTheme.grid.strokeDasharray} />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#4b5563" fontSize={10} />
                <YAxis stroke="#4b5563" fontSize={10} tickFormatter={formatBytes} />
                <Tooltip 
                  {...chartTheme.tooltip} 
                  labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')} 
                  formatter={(value: any) => formatThroughput(value)}
                />
                <Line type="monotone" dataKey="read" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="Read" />
                <Line type="monotone" dataKey="write" stroke="#10b981" strokeWidth={1.5} dot={false} name="Write" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 3. Disk I/O Utilization */}
        <Card className="bg-[#1a1d27] border-white/5 shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">Disk I/O Utilization (Active Time %)</CardTitle>
          </CardHeader>
          <CardContent className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ioUtilData}>
                <CartesianGrid stroke={chartTheme.grid.stroke} strokeDasharray={chartTheme.grid.strokeDasharray} />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#4b5563" fontSize={10} />
                <YAxis stroke="#4b5563" fontSize={10} domain={[0, 100]} />
                <Tooltip {...chartTheme.tooltip} labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')} />
                <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} name="I/O Active %" />
                <ThresholdLine y={80} label="High I/O Load (80%)" type="warning" />
                <ThresholdLine y={95} label="Disk Saturation (95%)" type="critical" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 4. Read/Write Latency */}
        <Card className="bg-[#1a1d27] border-white/5 shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">Disk R/W Latency (ms)</CardTitle>
          </CardHeader>
          <CardContent className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={latencyData}>
                <CartesianGrid stroke={chartTheme.grid.stroke} strokeDasharray={chartTheme.grid.strokeDasharray} />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#4b5563" fontSize={10} />
                <YAxis stroke="#4b5563" fontSize={10} />
                <Tooltip 
                  {...chartTheme.tooltip} 
                  labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')}
                  formatter={(value: any) => `${parseFloat(value).toFixed(2)} ms`}
                />
                <Line type="monotone" dataKey="read" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="Read Latency" />
                <Line type="monotone" dataKey="write" stroke="#10b981" strokeWidth={1.5} dot={false} name="Write Latency" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default DiskStorage;
