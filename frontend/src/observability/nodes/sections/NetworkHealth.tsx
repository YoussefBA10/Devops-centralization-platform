import React, { useState, useEffect } from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import * as prometheus from '../../../services/prometheusService';
import { combineSeries } from '../queries';
import { ThresholdLine } from '../components/ThresholdLine';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { format } from 'date-fns';

interface NetworkHealthProps {
  selectedNode: string;
  selectedInterface: string;
  onChangeInterface: (iface: string) => void;
  interfaces: string[];
  timeRange: { start: number; end: number };
  triggerRefresh: number;
}

export const NetworkHealth: React.FC<NetworkHealthProps> = ({
  selectedNode,
  selectedInterface,
  onChangeInterface: _onChangeInterface,
  interfaces,
  timeRange,
  triggerRefresh
}) => {
  const [loading, setLoading] = useState(true);
  const [throughputData, setThroughputData] = useState<any[]>([]);
  const [dropsData, setDropsData] = useState<any[]>([]);
  const [errorsData, setErrorsData] = useState<any[]>([]);
  const [conntrackData, setConntrackData] = useState<any[]>([]);
  
  const [tcpStats, setTcpStats] = useState({
    timeWait: 0,
    inUse: 0,
    allocated: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedNode) return;
      setLoading(true);

      const { start, end } = timeRange;
      const targetIface = selectedInterface || (interfaces.length > 0 ? interfaces[0] : 'eth0');

      try {
        // Fetch TCP state metrics (instant)
        const [twRes, inuseRes, allocRes] = await Promise.all([
          prometheus.queryInstantByKey('NET_TCP_TW', { node: selectedNode }),
          prometheus.queryInstantByKey('NET_TCP_INUSE', { node: selectedNode }),
          prometheus.queryInstantByKey('NET_TCP_ALLOC', { node: selectedNode })
        ]);

        setTcpStats({
          timeWait: twRes && twRes.length > 0 ? parseInt(twRes[0].value[1]) || 0 : 0,
          inUse: inuseRes && inuseRes.length > 0 ? parseInt(inuseRes[0].value[1]) || 0 : 0,
          allocated: allocRes && allocRes.length > 0 ? parseInt(allocRes[0].value[1]) || 0 : 0
        });

        // Range Queries
        const [rxRes, txRes, dropRxRes, dropTxRes, errRxRes, errTxRes, conntrackRes] = await Promise.all([
          prometheus.queryRangeByKey('NET_THROUGHPUT_RX', start, end, undefined, { node: selectedNode, iface: targetIface }),
          prometheus.queryRangeByKey('NET_THROUGHPUT_TX', start, end, undefined, { node: selectedNode, iface: targetIface }),
          prometheus.queryRangeByKey('NET_DROP_RX', start, end, undefined, { node: selectedNode, iface: targetIface }),
          prometheus.queryRangeByKey('NET_DROP_TX', start, end, undefined, { node: selectedNode, iface: targetIface }),
          prometheus.queryRangeByKey('NET_ERR_RX', start, end, undefined, { node: selectedNode, iface: targetIface }),
          prometheus.queryRangeByKey('NET_ERR_TX', start, end, undefined, { node: selectedNode, iface: targetIface }),
          prometheus.queryRangeByKey('CONNTRACK_UTIL', start, end, undefined, { node: selectedNode })
        ]);

        // Format throughput
        setThroughputData(combineSeries([
          ...(rxRes.map(s => ({ ...s, metric: { dir: 'rx' } }))),
          ...(txRes.map(s => ({ ...s, metric: { dir: 'tx' } })))
        ], 'dir'));

        // Format packet drops
        setDropsData(combineSeries([
          ...(dropRxRes.map(s => ({ ...s, metric: { dir: 'rx' } }))),
          ...(dropTxRes.map(s => ({ ...s, metric: { dir: 'tx' } })))
        ], 'dir'));

        // Format network errors
        setErrorsData(combineSeries([
          ...(errRxRes.map(s => ({ ...s, metric: { dir: 'rx' } }))),
          ...(errTxRes.map(s => ({ ...s, metric: { dir: 'tx' } })))
        ], 'dir'));

        // Format conntrack utilization
        setConntrackData(prometheus.formatSeries(conntrackRes));

      } catch (error) {
        console.error('Failed to load network analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedNode, selectedInterface, interfaces, timeRange, triggerRefresh]);

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

  const formatBits = (bytesPerSec: number) => {
    const bitsPerSec = bytesPerSec * 8;
    if (bitsPerSec < 1000) return `${bitsPerSec.toFixed(1)} bps`;
    if (bitsPerSec < 1000000) return `${(bitsPerSec / 1000).toFixed(1)} Kbps`;
    return `${(bitsPerSec / 1000000).toFixed(1)} Mbps`;
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
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="bg-[#1a1d27] border-white/5 h-24 animate-pulse">
              <div />
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
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
      {/* TCP socket state metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#1a1d27] border-white/5 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-[#a1a1aa]">Active TCP Connections</p>
            <p className="text-xl font-mono font-black text-white mt-1">{tcpStats.inUse}</p>
          </div>
          <span className="px-2 py-0.5 text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">Sockets inuse</span>
        </Card>

        <Card className="bg-[#1a1d27] border-white/5 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-[#a1a1aa]">Allocated Sockets</p>
            <p className="text-xl font-mono font-black text-white mt-1">{tcpStats.allocated}</p>
          </div>
          <span className="px-2 py-0.5 text-[8px] font-black uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">Sockets alloc</span>
        </Card>

        <Card className="bg-[#1a1d27] border-white/5 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-[#a1a1aa]">Sockets in TIME_WAIT</p>
            <p className="text-xl font-mono font-black text-white mt-1">{tcpStats.timeWait}</p>
          </div>
          <span className="px-2 py-0.5 text-[8px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">TIME_WAIT</span>
        </Card>
      </div>

      {/* Network Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Throughput */}
        <Card className="bg-[#1a1d27] border-white/5 shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">Throughput (RX / TX)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={throughputData}>
                <CartesianGrid stroke={chartTheme.grid.stroke} strokeDasharray={chartTheme.grid.strokeDasharray} />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#4b5563" fontSize={10} />
                <YAxis stroke="#4b5563" fontSize={10} tickFormatter={formatBytes} />
                <Tooltip 
                  {...chartTheme.tooltip} 
                  labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')} 
                  formatter={(value: any) => formatBits(value)}
                />
                <Line type="monotone" dataKey="rx" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="Receive (RX)" />
                <Line type="monotone" dataKey="tx" stroke="#10b981" strokeWidth={1.5} dot={false} name="Transmit (TX)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 2. Packet Drop Rate */}
        <Card className="bg-[#1a1d27] border-white/5 shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">Packet Drop Rate (drops/s)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dropsData}>
                <CartesianGrid stroke={chartTheme.grid.stroke} strokeDasharray={chartTheme.grid.strokeDasharray} />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#4b5563" fontSize={10} />
                <YAxis stroke="#4b5563" fontSize={10} />
                <Tooltip {...chartTheme.tooltip} labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')} />
                <Line type="monotone" dataKey="rx" stroke="#ec4899" strokeWidth={1.5} dot={false} name="RX Drops" />
                <Line type="monotone" dataKey="tx" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="TX Drops" />
                <ThresholdLine y={5} label="High Drop Rate (5/s)" type="warning" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 3. Network Errors */}
        <Card className="bg-[#1a1d27] border-white/5 shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">Network Errors (errors/s)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={errorsData}>
                <CartesianGrid stroke={chartTheme.grid.stroke} strokeDasharray={chartTheme.grid.strokeDasharray} />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#4b5563" fontSize={10} />
                <YAxis stroke="#4b5563" fontSize={10} />
                <Tooltip {...chartTheme.tooltip} labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')} />
                <Line type="monotone" dataKey="rx" stroke="#ef4444" strokeWidth={1.5} dot={false} name="RX Errors" />
                <Line type="monotone" dataKey="tx" stroke="#f43f5e" strokeWidth={1.5} dot={false} name="TX Errors" />
                <ThresholdLine y={1} label="Warning Threshold (1/s)" type="warning" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 4. Conntrack Utilization */}
        <Card className="bg-[#1a1d27] border-white/5 shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">Connection Tracker (conntrack) Utilization %</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={conntrackData}>
                <CartesianGrid stroke={chartTheme.grid.stroke} strokeDasharray={chartTheme.grid.strokeDasharray} />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#4b5563" fontSize={10} />
                <YAxis stroke="#4b5563" fontSize={10} domain={[0, 100]} />
                <Tooltip {...chartTheme.tooltip} labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')} />
                <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Conntrack Used %" />
                <ThresholdLine y={70} label="Warning (70%)" type="warning" />
                <ThresholdLine y={90} label="Critical (90%)" type="critical" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default NetworkHealth;
