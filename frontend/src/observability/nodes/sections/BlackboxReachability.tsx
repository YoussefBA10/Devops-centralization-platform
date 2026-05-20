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

interface PortProbe {
  port: string;
  success: boolean;
  durationMs: number;
}

export const BlackboxReachability: React.FC<BlackboxReachabilityProps> = ({
  selectedNode,
  timeRange,
  triggerRefresh
}) => {
  const [loading, setLoading] = useState(true);
  const [icmpTimeline, setIcmpTimeline] = useState<any[]>([]);
  const [icmpLatency, setIcmpLatency] = useState<any[]>([]);
  const [portProbes, setPortProbes] = useState<PortProbe[]>([]);
  const [sslExpiryDays, setSslExpiryDays] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedNode) return;
      setLoading(true);

      const { start, end } = timeRange;
      const cleanIp = getCleanNodeIp(selectedNode);

      try {
        // 1. Fetch SSL cert expiry
        const sslRes = await prometheus.queryInstantByKey(
          'SSL_CERT_EXPIRY',
          { node: selectedNode, node_ip: cleanIp }
        );
        if (sslRes && sslRes.length > 0) {
          setSslExpiryDays(parseFloat(sslRes[0].value[1]));
        } else {
          setSslExpiryDays(null);
        }

        // 2. Fetch TCP Port Probes (Instant query)
        const [portSuccessRes, portDurationRes] = await Promise.all([
          prometheus.queryInstantByKey('BLACKBOX_TCP_SUCCESS', { node: selectedNode, node_ip: cleanIp }),
          prometheus.queryInstantByKey('BLACKBOX_TCP_DURATION', { node: selectedNode, node_ip: cleanIp })
        ]);

        const durationMap: Record<string, number> = {};
        portDurationRes.forEach(r => {
          const inst = r.metric.instance || '';
          const port = inst.split(':')[1] || '';
          if (port) {
            durationMap[port] = parseFloat(r.value[1]) * 1000;
          }
        });

        const probes: PortProbe[] = [];
        portSuccessRes.forEach(r => {
          const inst = r.metric.instance || '';
          const port = inst.split(':')[1] || '';
          if (port) {
            probes.push({
              port,
              success: parseFloat(r.value[1]) === 1,
              durationMs: durationMap[port] || 0
            });
          }
        });
        setPortProbes(probes.sort((a, b) => parseInt(a.port) - parseInt(b.port)));

        // 3. Fetch ICMP Timeline and Latency over range
        const [timelineRes, latencyRes] = await Promise.all([
          prometheus.queryRangeByKey('BLACKBOX_ICMP_SUCCESS', start, end, undefined, { node: selectedNode, node_ip: cleanIp }),
          prometheus.queryRangeByKey('BLACKBOX_ICMP_DURATION', start, end, undefined, { node: selectedNode, node_ip: cleanIp })
        ]);

        const latencyMs: prometheus.MetricResult[] = latencyRes.map(series => ({
          ...series,
          values: series.values.map(([ts, val]) => [ts, ((parseFloat(val) || 0) * 1000).toString()])
        }));

        setIcmpTimeline(prometheus.formatSeries(timelineRes));
        setIcmpLatency(prometheus.formatSeries(latencyMs));

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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. HTTP Probe Timeline */}
        <Card className="bg-[#1a1d27] border-white/5 shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">HTTP Probe Reachability Timeline</CardTitle>
          </CardHeader>
          <CardContent className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={icmpTimeline}>
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
              <LineChart data={icmpLatency}>
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

        {/* 3. SSL Expiry Details Card */}
        <Card className="bg-[#1a1d27] border-white/5 shadow-2xl flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">SSL Certificate Expiry</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
            {sslExpiryDays !== null ? (
              <div className="text-center space-y-2">
                <p className="text-4xl font-mono font-black tracking-tight text-white">
                  {Math.round(sslExpiryDays)}
                </p>
                <p className="text-xs font-bold uppercase tracking-wider text-[#a1a1aa]">
                  Days Remaining
                </p>
                <div className="pt-2">
                  {sslExpiryDays < 15 ? (
                    <span className="px-3 py-1 text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full">
                      Critical: Near Expiry
                    </span>
                  ) : sslExpiryDays < 30 ? (
                    <span className="px-3 py-1 text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">
                      Warning: Expires Soon
                    </span>
                  ) : (
                    <span className="px-3 py-1 text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                      Certificate Valid
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center">
                No active HTTPS / SSL probe targeting this host.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. TCP Port Probes Table */}
      <Card className="bg-[#1a1d27] border-white/5 shadow-2xl overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">TCP Local Service Port Probes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {portProbes.length === 0 ? (
            <div className="p-6 text-xs text-muted-foreground text-center">
              No blackbox TCP port probes configured for node IP {getCleanNodeIp(selectedNode)}.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs font-medium">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-[#a1a1aa] text-[9px] uppercase tracking-widest">
                  <th className="p-4 font-black">Port</th>
                  <th className="p-4 font-black">Probe Status</th>
                  <th className="p-4 font-black text-right">Response Time (Latency)</th>
                </tr>
              </thead>
              <tbody>
                {portProbes.map(probe => (
                  <tr key={probe.port} className="border-b border-white/5 hover:bg-white/[0.01]">
                    <td className="p-4 font-mono font-bold text-white">
                      :{probe.port}
                    </td>
                    <td className="p-4">
                      {probe.success ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                          ONLINE / LISTENING
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full">
                          DOWN / CLOSED
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right font-mono text-[#a1a1aa] font-bold">
                      {probe.durationMs.toFixed(2)} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
export default BlackboxReachability;
