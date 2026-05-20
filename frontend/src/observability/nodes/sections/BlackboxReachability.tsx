import React, { useState, useEffect } from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import * as prometheus from '../../../services/prometheusService';
import { getCleanNodeIp } from '../queries';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { format } from 'date-fns';

interface BlackboxReachabilityProps {
  selectedNode: string;
  timeRange: { start: number; end: number };
  triggerRefresh: number;
}



export const BlackboxReachability: React.FC<BlackboxReachabilityProps> = ({
  selectedNode,
  timeRange,
  triggerRefresh
}) => {
  const [loading, setLoading] = useState(true);
  const [httpTimeline, setHttpTimeline] = useState<any[]>([]);
  const [httpLatency, setHttpLatency] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedNode) return;
      setLoading(true);

      const { start, end } = timeRange;
      const cleanIp = getCleanNodeIp(selectedNode);

      try {
        // 3. Fetch HTTP Timeline and Latency over range
        const [timelineRes, latencyRes] = await Promise.all([
          prometheus.queryRangeByKey('BLACKBOX_HTTP_SUCCESS', start, end, undefined, { node: selectedNode, node_ip: cleanIp }),
          prometheus.queryRangeByKey('BLACKBOX_HTTP_DURATION', start, end, undefined, { node: selectedNode, node_ip: cleanIp })
        ]);

        const latencyMs: prometheus.MetricResult[] = latencyRes.map(series => ({
          ...series,
          values: series.values.map(([ts, val]) => [ts, ((parseFloat(val) || 0) * 1000).toString()])
        }));

        setHttpTimeline(prometheus.formatSeries(timelineRes));
        setHttpLatency(prometheus.formatSeries(latencyMs));

      } catch (error) {
        console.error('Failed to load blackbox reachability metrics:', error);
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
          <Card key={i} className="bg-[#1a1d27] border-white/5 h-64 animate-pulse">
            <div />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. HTTP Probe Timeline */}
        <Card className="bg-[#1a1d27] border-white/5 shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">HTTP Probe Reachability Timeline</CardTitle>
          </CardHeader>
          <CardContent className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={httpTimeline}>
                <CartesianGrid stroke={chartTheme.grid.stroke} strokeDasharray={chartTheme.grid.strokeDasharray} />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#4b5563" fontSize={10} />
                <YAxis stroke="#4b5563" fontSize={10} domain={[0, 1.2]} tickFormatter={v => v === 1 ? 'UP' : v === 0 ? 'DOWN' : ''} />
                <Tooltip {...chartTheme.tooltip} labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')} />
                <Line type="step" dataKey="value" stroke="#10b981" strokeWidth={2} dot={false} name="HTTP Success" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 2. HTTP Latency over time */}
        <Card className="bg-[#1a1d27] border-white/5 shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">HTTP Probe Latency (ms)</CardTitle>
          </CardHeader>
          <CardContent className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={httpLatency}>
                <CartesianGrid stroke={chartTheme.grid.stroke} strokeDasharray={chartTheme.grid.strokeDasharray} />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#4b5563" fontSize={10} />
                <YAxis stroke="#4b5563" fontSize={10} />
                <Tooltip 
                  {...chartTheme.tooltip} 
                  labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')}
                  formatter={(value: any) => `${parseFloat(value).toFixed(2)} ms`}
                />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="Latency" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>


    </div>
  );
};
export default BlackboxReachability;
