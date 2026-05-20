import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import * as prometheus from '../../../services/prometheusService';
import { combineSeries } from '../queries';
import { ThresholdLine } from '../components/ThresholdLine';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { format } from 'date-fns';

interface CpuAnalysisProps {
  selectedNode: string;
  timeRange: { start: number; end: number };
  triggerRefresh: number;
}

export const CpuAnalysis: React.FC<CpuAnalysisProps> = ({ selectedNode, timeRange, triggerRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [cpuUsageData, setCpuUsageData] = useState<any[]>([]);
  const [cpuStealData, setCpuStealData] = useState<any[]>([]);
  const [loadAvgData, setLoadAvgData] = useState<any[]>([]);
  const [cpuPsiData, setCpuPsiData] = useState<any[]>([]);
  const [coresCount, setCoresCount] = useState<number>(4);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedNode) return;
      setLoading(true);

      const { start, end } = timeRange;

      try {
        // Fetch cores count first via instant query
        const coresRes = await prometheus.queryInstantByKey(
          'CPU_CORES_COUNT',
          { node: selectedNode }
        );
        if (coresRes && coresRes.length > 0) {
          setCoresCount(parseInt(coresRes[0].value[1]) || 4);
        }

        // Run range queries in parallel
        const [modeUsageRes, stealRes, load1Res, load5Res, load15Res, psiRes] = await Promise.all([
          prometheus.queryRangeByKey('CPU_USAGE_MODES_ALL', start, end, undefined, { node: selectedNode }),
          prometheus.queryRangeByKey('CPU_STEAL', start, end, undefined, { node: selectedNode }),
          prometheus.queryRangeByKey('LOAD_AVG_3LINE', start, end, undefined, { node: selectedNode, val: '1' }),
          prometheus.queryRangeByKey('LOAD_AVG_3LINE', start, end, undefined, { node: selectedNode, val: '5' }),
          prometheus.queryRangeByKey('LOAD_AVG_3LINE', start, end, undefined, { node: selectedNode, val: '15' }),
          prometheus.queryRangeByKey('CPU_PSI', start, end, undefined, { node: selectedNode })
        ]);

        // Format Stacked CPU usage by mode
        setCpuUsageData(combineSeries(modeUsageRes, 'mode'));

        // Format Steal Time
        setCpuStealData(prometheus.formatSeries(stealRes));

        // Format Load Average 3-lines
        const combinedLoad = combineSeries([
          ...(load1Res.map(s => ({ ...s, metric: { val: 'load1' } }))),
          ...(load5Res.map(s => ({ ...s, metric: { val: 'load5' } }))),
          ...(load15Res.map(s => ({ ...s, metric: { val: 'load15' } })))
        ], 'val');
        setLoadAvgData(combinedLoad);

        // Format CPU PSI data
        setCpuPsiData(prometheus.formatSeries(psiRes));

      } catch (error) {
        console.error('Failed to load CPU analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedNode, timeRange, triggerRefresh]);

  const formatTime = (tick: number) => {
    try {
      return format(new Date(tick), 'HH:mm');
    } catch {
      return '';
    }
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="bg-[#1a1d27] border-white/5 h-72 animate-pulse">
            <div />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. CPU Usage by Mode */}
      <Card className="bg-[#1a1d27] border-white/5 shadow-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">CPU Usage Breakdown (%)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cpuUsageData}>
              <defs>
                <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="sysGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="ioGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartTheme.grid.stroke} strokeDasharray={chartTheme.grid.strokeDasharray} />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#4b5563" fontSize={10} />
              <YAxis stroke="#4b5563" fontSize={10} domain={[0, 100]} />
              <Tooltip {...chartTheme.tooltip} labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')} />
              <Area type="monotone" dataKey="user" stackId="1" stroke="#3b82f6" fill="url(#userGrad)" strokeWidth={1.5} name="User" />
              <Area type="monotone" dataKey="system" stackId="1" stroke="#ef4444" fill="url(#sysGrad)" strokeWidth={1.5} name="System" />
              <Area type="monotone" dataKey="iowait" stackId="1" stroke="#f59e0b" fill="url(#ioGrad)" strokeWidth={1.5} name="I/O Wait" />
              <Area type="monotone" dataKey="steal" stackId="1" stroke="#a855f7" fillOpacity={0.1} strokeWidth={1.5} name="Steal" />
              <Area type="monotone" dataKey="softirq" stackId="1" stroke="#10b981" fillOpacity={0.1} strokeWidth={1.5} name="SoftIRQ" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 2. CPU Steal Time */}
      <Card className="bg-[#1a1d27] border-white/5 shadow-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">CPU Steal Time (%) & Noisy Neighbor detection</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cpuStealData}>
              <CartesianGrid stroke={chartTheme.grid.stroke} strokeDasharray={chartTheme.grid.strokeDasharray} />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#4b5563" fontSize={10} />
              <YAxis stroke="#4b5563" fontSize={10} />
              <Tooltip {...chartTheme.tooltip} labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')} />
              <Line type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={2} dot={false} name="Steal Time" />
              <ThresholdLine y={5} label="Noisy Neighbor Threshold (5%)" type="warning" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 3. Load Average */}
      <Card className="bg-[#1a1d27] border-white/5 shadow-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">System Load Average (1m, 5m, 15m)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={loadAvgData}>
              <CartesianGrid stroke={chartTheme.grid.stroke} strokeDasharray={chartTheme.grid.strokeDasharray} />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#4b5563" fontSize={10} />
              <YAxis stroke="#4b5563" fontSize={10} />
              <Tooltip {...chartTheme.tooltip} labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')} />
              <Line type="monotone" dataKey="load1" stroke="#3b82f6" strokeWidth={2} dot={false} name="Load 1m" />
              <Line type="monotone" dataKey="load5" stroke="#10b981" strokeWidth={1.5} dot={false} name="Load 5m" />
              <Line type="monotone" dataKey="load15" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Load 15m" />
              <ThresholdLine y={coresCount} label={`Core Count Limit (${coresCount} Cores)`} type="critical" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 4. CPU PSI Pressure */}
      <Card className="bg-[#1a1d27] border-white/5 shadow-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">CPU PSI Pressure (% time waiting)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {cpuPsiData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
              No CPU PSI Pressure data available (requires kernel with PSI enabled)
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cpuPsiData}>
                <CartesianGrid stroke={chartTheme.grid.stroke} strokeDasharray={chartTheme.grid.strokeDasharray} />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#4b5563" fontSize={10} />
                <YAxis stroke="#4b5563" fontSize={10} />
                <Tooltip {...chartTheme.tooltip} labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')} />
                <Line type="monotone" dataKey="value" stroke="#ec4899" strokeWidth={2} dot={false} name="Some CPU Waiting" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
export default CpuAnalysis;
