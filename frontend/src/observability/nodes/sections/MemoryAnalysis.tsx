import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar } from 'recharts';
import * as prometheus from '../../../services/prometheusService';
import { combineSeries } from '../queries';
import { ThresholdLine } from '../components/ThresholdLine';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { format } from 'date-fns';

interface MemoryAnalysisProps {
  selectedNode: string;
  timeRange: { start: number; end: number };
  triggerRefresh: number;
}

export const MemoryAnalysis: React.FC<MemoryAnalysisProps> = ({ selectedNode, timeRange, triggerRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [memBreakdownData, setMemBreakdownData] = useState<any[]>([]);
  const [memPercentData, setMemPercentData] = useState<any[]>([]);
  const [swapData, setSwapData] = useState<any[]>([]);
  const [oomData, setOomData] = useState<any[]>([]);
  const [memPsiData, setMemPsiData] = useState<any[]>([]);
  
  const [swapTotal, setSwapTotal] = useState<number>(0);
  const [latestOomCount, setLatestOomCount] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedNode) return;
      setLoading(true);

      const { start, end } = timeRange;
      const rangeSeconds = end - start;
      const stepForOom = rangeSeconds > 86400 ? '1h' : '10m';

      try {
        // Fetch Swap Total
        const swapTotalRes = await prometheus.queryInstantByKey(
          'SWAP_TOTAL',
          { node: selectedNode }
        );
        if (swapTotalRes && swapTotalRes.length > 0) {
          setSwapTotal(parseFloat(swapTotalRes[0].value[1]) || 0);
        }

        // Fetch OOM count in window
        const oomTotalRes = await prometheus.queryInstantByKey(
          'OOM_KILLS',
          { node: selectedNode, range: `${rangeSeconds}s` }
        );
        if (oomTotalRes && oomTotalRes.length > 0) {
          setLatestOomCount(Math.round(parseFloat(oomTotalRes[0].value[1])) || 0);
        }

        // Run range queries
        const [usedRaw, cachedRaw, buffersRaw, freeRaw, pctRes, swapUsageRes, oomRangeRes, psiRes] = await Promise.all([
          prometheus.queryRangeByKey('MEM_USED', start, end, undefined, { node: selectedNode }),
          prometheus.queryRangeByKey('MEM_CACHED', start, end, undefined, { node: selectedNode }),
          prometheus.queryRangeByKey('MEM_BUFFERS', start, end, undefined, { node: selectedNode }),
          prometheus.queryRangeByKey('MEM_FREE', start, end, undefined, { node: selectedNode }),
          prometheus.queryRangeByKey('MEMORY_USED_PCT', start, end, undefined, { node: selectedNode }),
          prometheus.queryRangeByKey('SWAP_USED_PCT', start, end, undefined, { node: selectedNode }),
          prometheus.queryRangeByKey('OOM_KILLS', start, end, undefined, { node: selectedNode, range: stepForOom }),
          prometheus.queryRangeByKey('MEM_PSI', start, end, undefined, { node: selectedNode })
        ]);

        const toGB = (res: any[]) => {
          return res.map(series => ({
            ...series,
            values: series.values.map(([ts, val]: [number, string]) => [ts, (parseFloat(val) || 0) / 1073741824])
          }));
        };

        const usedRes = toGB(usedRaw);
        const cachedRes = toGB(cachedRaw);
        const buffersRes = toGB(buffersRaw);
        const freeRes = toGB(freeRaw);

        // Stacked Memory breakdown in GB
        const combinedMem = combineSeries([
          ...(usedRes.map(s => ({ ...s, metric: { mode: 'used' } }))),
          ...(cachedRes.map(s => ({ ...s, metric: { mode: 'cached' } }))),
          ...(buffersRes.map(s => ({ ...s, metric: { mode: 'buffers' } }))),
          ...(freeRes.map(s => ({ ...s, metric: { mode: 'free' } })))
        ], 'mode');
        setMemBreakdownData(combinedMem);

        // Memory usage % over time
        setMemPercentData(prometheus.formatSeries(pctRes));

        // Swap usage % over time
        setSwapData(prometheus.formatSeries(swapUsageRes));

        // OOM Kills
        setOomData(prometheus.formatSeries(oomRangeRes));

        // Memory PSI
        setMemPsiData(prometheus.formatSeries(psiRes));

      } catch (error) {
        console.error('Failed to load memory analytics:', error);
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
      {/* 1. Memory Breakdown */}
      <Card className="bg-[#1a1d27] border-white/5 shadow-2xl">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">Memory Breakdown (GB)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={memBreakdownData}>
              <defs>
                <linearGradient id="memUsedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="memCachedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartTheme.grid.stroke} strokeDasharray={chartTheme.grid.strokeDasharray} />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#4b5563" fontSize={10} />
              <YAxis stroke="#4b5563" fontSize={10} unit="G" />
              <Tooltip {...chartTheme.tooltip} labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')} />
              <Area type="monotone" dataKey="used" stackId="1" stroke="#3b82f6" fill="url(#memUsedGrad)" strokeWidth={1.5} name="Used" />
              <Area type="monotone" dataKey="cached" stackId="1" stroke="#10b981" fill="url(#memCachedGrad)" strokeWidth={1.5} name="Cached" />
              <Area type="monotone" dataKey="buffers" stackId="1" stroke="#f59e0b" fillOpacity={0.1} strokeWidth={1.5} name="Buffers" />
              <Area type="monotone" dataKey="free" stackId="1" stroke="#6b7280" fillOpacity={0.1} strokeWidth={1.5} name="Free" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 2. Memory Used % */}
      <Card className="bg-[#1a1d27] border-white/5 shadow-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">Memory Utilization (%)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={memPercentData}>
              <CartesianGrid stroke={chartTheme.grid.stroke} strokeDasharray={chartTheme.grid.strokeDasharray} />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#4b5563" fontSize={10} />
              <YAxis stroke="#4b5563" fontSize={10} domain={[0, 100]} />
              <Tooltip {...chartTheme.tooltip} labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')} />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} name="Used Memory %" />
              <ThresholdLine y={70} label="Warning (70%)" type="warning" />
              <ThresholdLine y={85} label="Critical (85%)" type="critical" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 3. Swap Usage */}
      <Card className="bg-[#1a1d27] border-white/5 shadow-2xl">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">Swap Space Utilization</CardTitle>
          {swapTotal === 0 && (
            <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full animate-pulse">
              No Swap Configured
            </span>
          )}
        </CardHeader>
        <CardContent className="h-64">
          {swapTotal === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
              Swap is disabled or not configured on this host.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={swapData}>
                <CartesianGrid stroke={chartTheme.grid.stroke} strokeDasharray={chartTheme.grid.strokeDasharray} />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#4b5563" fontSize={10} />
                <YAxis stroke="#4b5563" fontSize={10} domain={[0, 100]} />
                <Tooltip {...chartTheme.tooltip} labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')} />
                <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} name="Swap Used %" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 4. OOM Kills */}
      <Card className="bg-[#1a1d27] border-white/5 shadow-2xl">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">OOM Kill Events</CardTitle>
          {latestOomCount > 0 ? (
            <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-full animate-bounce">
              {latestOomCount} OOM Kill(s) in Window
            </span>
          ) : (
            <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full">
              No OOM Kills Detected
            </span>
          )}
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={oomData}>
              <CartesianGrid stroke={chartTheme.grid.stroke} strokeDasharray={chartTheme.grid.strokeDasharray} />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#4b5563" fontSize={10} />
              <YAxis stroke="#4b5563" fontSize={10} allowDecimals={false} />
              <Tooltip {...chartTheme.tooltip} labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')} />
              <Bar dataKey="value" fill="#ef4444" name="OOM Kills" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 5. Memory PSI Pressure */}
      <Card className="bg-[#1a1d27] border-white/5 shadow-2xl col-span-1 lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">Memory PSI Pressure (% time waiting)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {memPsiData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
              No Memory PSI Pressure data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={memPsiData}>
                <CartesianGrid stroke={chartTheme.grid.stroke} strokeDasharray={chartTheme.grid.strokeDasharray} />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#4b5563" fontSize={10} />
                <YAxis stroke="#4b5563" fontSize={10} />
                <Tooltip {...chartTheme.tooltip} labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')} />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} name="Memory Waiting Time %" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
export default MemoryAnalysis;
